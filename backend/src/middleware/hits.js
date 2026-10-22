import crypto from "node:crypto";
import db from "../db/index.js";
import { userForSession } from "../services/authService.js";
import { SESSION_COOKIE } from "./auth.js";
import { ADMIN_IPS, isOperatorUser } from "../lib/admin.js";

const bumpHit = db.prepare(`
  INSERT INTO daily_hits (day, path, hits) VALUES (?, ?, 1)
  ON CONFLICT(day, path) DO UPDATE SET hits = hits + 1
`);
const addVisitor = db.prepare(
  `INSERT OR IGNORE INTO daily_visitors (day, vhash) VALUES (?, ?)`
);
const addHuman = db.prepare(`INSERT OR IGNORE INTO daily_humans (day, vhash) VALUES (?, ?)`);
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
    .replace(/\/news\/[^/]+/, "/news/:slug")
    .replace(/\/database\/[^/]+/, "/database/:id")
    .slice(0, 120);

// Nur echte Routen der App zählen - der Rest (WordPress-/.git-Scans,
// zufällige Firmen-/Domain-Namen, sonstiges Bot-Rauschen) sind keine
// Besucher, sondern automatisierte Scanner, die JEDE öffentliche Website
// abklappern. Bewusst als Allowlist statt Blockliste, weil neues
// Scanner-Rauschen sonst laufend nachgepflegt werden müsste.
const STATIC_PATHS = new Set([
  "/", "/login", "/register", "/passwort-vergessen", "/passwort-zuruecksetzen",
  "/verify", "/impressum", "/datenschutz", "/nutzungsbedingungen", "/sets", "/add", "/import",
  "/sammlung", "/verkauft", "/analyse", "/statistik", "/konto", "/orden", "/watchlist", "/news",
]);
const DYNAMIC_PREFIXES = ["/sets/", "/database/", "/card/", "/illustrator/", "/news/"];
export const isKnownRoute = (rawPath) => {
  const path = rawPath.length > 1 ? rawPath.replace(/\/+$/, "") : rawPath;
  return STATIC_PATHS.has(path) || DYNAMIC_PREFIXES.some((p) => path.startsWith(p) && path.length > p.length);
};

// Bekannte Roboter (Suchmaschinen, KI-Crawler, Vorschau-Dienste, Skripte, Monitoring) anhand der
// Browserkennung; ohne Kennung gilt auch als Roboter. Gespeichert wird die Kennung nie.
const BOT_UA =
  /bot|crawl|spider|slurp|scrap|fetch|headless|preview|monitor|uptime|lighthouse|pingdom|curl|wget|python|java\/|go-http|okhttp|axios|httpclient|libwww|node-|undici|postman|facebookexternalhit|whatsapp|telegram|discord|slack|twitter|linkedin|pinterest|embedly|gpt|claude|anthropic|perplexity|ahrefs|semrush|mj12|bytespider|yandex|baidu|duckduck|applebot|bing/i;
const isBot = (req) => {
  const ua = String(req.headers["user-agent"] ?? "");
  return !ua || BOT_UA.test(ua);
};

// POST /api/ping: das Frontend meldet, dass jemand auf der Seite wirklich etwas getan hat
// (scrollen, klicken, tippen). Nur so zählen wir "menschliche Besucher" - Roboter, die nur
// Seiten abrufen oder JavaScript ausführen, ohne zu interagieren, fallen heraus.
export function humanPing(req, res) {
  try {
    if (req.ip && !isBot(req) && !isOperator(req)) {
      const day = localDay();
      addHuman.run(day, visitorHash(req.ip, day));
    }
  } catch {
    /* Zählung darf nie einen Request stören */
  }
  res.status(204).end();
}

// Besucher-Hash: nicht umkehrbar, wechselt täglich, nur zum Zählen.
const visitorHash = (ip, day) =>
  crypto.createHash("sha256").update(`${ip}|${day}|${SALT}`).digest("hex").slice(0, 20);

// Ist der Zugriff vom Betreiber selbst? (bekannte IP oder als Admin angemeldet)
function isOperator(req) {
  if (req.ip && ADMIN_IPS.has(req.ip)) return true;
  return isOperatorUser(userForSession(req.cookies?.[SESSION_COOKIE]));
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
      !isOperator(req) && // eigene Zugriffe des Betreibers nicht mitzählen
      isKnownRoute(req.path) // Bot-/Scanner-Rauschen (WordPress, .git, ...) nicht mitzählen
    ) {
      const last = req.path.split("/").pop() || "";
      if (!last.includes(".")) {
        if (isBot(req)) bumpStat.run(day, "bot_hits"); // getrennt ausweisen, nicht als Besucher zählen
        else {
          bumpHit.run(day, normalize(req.path));
          if (req.ip) addVisitor.run(day, visitorHash(req.ip, day));
        }
      }
    }
  } catch {
    /* Zählung darf nie einen Request stören */
  }
  next();
}
