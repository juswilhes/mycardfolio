import crypto from "node:crypto";
import db from "../db/index.js";
import { userForSession } from "../services/authService.js";
import { SESSION_COOKIE } from "./auth.js";
import { ADMIN_EMAIL, ADMIN_IPS } from "../lib/admin.js";

const bumpHit = db.prepare(`
  INSERT INTO daily_hits (day, path, hits) VALUES (?, ?, 1)
  ON CONFLICT(day, path) DO UPDATE SET hits = hits + 1
`);
const addVisitor = db.prepare(
  `INSERT OR IGNORE INTO daily_visitors (day, vhash) VALUES (?, ?)`
);
const bumpStat = db.prepare(`
  INSERT INTO daily_stat (day, key, n) VALUES (?, ?, 1)
  ON CONFLICT(day, key) DO UPDATE SET n = n + 1
`);

const SALT =
  db.prepare(`SELECT value FROM app_meta WHERE key = 'visitor_salt'`).get()?.value || "";

const localDay = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
};

// Dynamische ID-Segmente zusammenfassen, damit "Top-Seiten" nicht in
// tausend Einzel-URLs zerfallen.
const normalize = (path) =>
  path
    .replace(/\/card\/[^/]+/, "/card/:id")
    .replace(/\/sets\/[^/]+/, "/sets/:id")
    .replace(/\/database\/[^/]+/, "/database/:id")
    .slice(0, 120);

// Besucher-Hash: nicht umkehrbar, wechselt täglich, nur zum Zählen.
const visitorHash = (ip, day) =>
  crypto.createHash("sha256").update(`${ip}|${day}|${SALT}`).digest("hex").slice(0, 20);

// Ist der Zugriff vom Betreiber selbst? (bekannte IP oder als Admin angemeldet)
function isOperator(req) {
  if (req.ip && ADMIN_IPS.has(req.ip)) return true;
  if (!ADMIN_EMAIL) return false;
  const u = userForSession(req.cookies?.[SESSION_COOKIE]);
  return !!u && String(u.email).toLowerCase() === ADMIN_EMAIL;
}

export function countPageView(req, res, next) {
  const day = localDay();

  // Serverfehler (5xx) IMMER zählen – ein Bug ist ein Bug, egal wer ihn trifft.
  res.on("finish", () => {
    if (res.statusCode >= 500) {
      try {
        bumpStat.run(day, "5xx");
      } catch {
        /* egal */
      }
    }
  });

  try {
    if (
      req.method === "GET" &&
      !req.path.startsWith("/api") &&
      !isOperator(req) // eigene Zugriffe des Betreibers nicht mitzählen
    ) {
      const last = req.path.split("/").pop() || "";
      if (!last.includes(".")) {
        bumpHit.run(day, normalize(req.path));
        if (req.ip) addVisitor.run(day, visitorHash(req.ip, day));
      }
    }
  } catch {
    /* Zählung darf nie einen Request stören */
  }
  next();
}
