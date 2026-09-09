import crypto from "node:crypto";
import db from "../db/index.js";

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

export function countPageView(req, res, next) {
  const day = localDay();

  // Serverfehler (5xx) pro Tag zählen – für die "läuft alles?"-Zeile.
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
    if (req.method === "GET" && !req.path.startsWith("/api")) {
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
