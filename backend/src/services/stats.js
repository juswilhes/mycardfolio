import db from "../db/index.js";

const ymd = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;

// Kennzahlen für den Tagesbericht. "Gestern" = voriger Kalendertag
// (Serverzeit). created_at der Nutzer/Sessions ist UTC – bei Serverzeit
// Europe/Berlin weicht das nur in den ersten 1–2 Nachtstunden ab, für
// einen Tagesüberblick vernachlässigbar.
export function dailySummary() {
  const now = new Date();
  const y = new Date(now);
  y.setDate(y.getDate() - 1);
  const yesterday = ymd(y);

  const days7 = [];
  for (let i = 7; i >= 1; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    days7.push(ymd(d));
  }

  const hitsYesterday =
    db.prepare(`SELECT COALESCE(SUM(hits),0) AS n FROM daily_hits WHERE day = ?`).get(yesterday).n;

  const topPages = db
    .prepare(
      `SELECT path, hits FROM daily_hits WHERE day = ? ORDER BY hits DESC LIMIT 6`
    )
    .all(yesterday);

  const trend = days7.map((day) => ({
    day,
    hits: db.prepare(`SELECT COALESCE(SUM(hits),0) AS n FROM daily_hits WHERE day = ?`).get(day).n,
  }));

  const newUsers = db
    .prepare(`SELECT COUNT(*) AS n FROM users WHERE substr(created_at,1,10) = ?`)
    .get(yesterday).n;
  const totalUsers = db.prepare(`SELECT COUNT(*) AS n FROM users`).get().n;
  const verifiedUsers = db.prepare(`SELECT COUNT(*) AS n FROM users WHERE email_verified = 1`).get().n;

  const loginsYesterday = db
    .prepare(`SELECT COUNT(*) AS n FROM sessions WHERE substr(created_at,1,10) = ?`)
    .get(yesterday).n;
  const activeSessions = db
    .prepare(`SELECT COUNT(*) AS n FROM sessions WHERE expires_at > datetime('now')`)
    .get().n;

  const collectors = db
    .prepare(`SELECT COUNT(DISTINCT user_id) AS n FROM collection_items`)
    .get().n;
  const totalCards = db
    .prepare(`SELECT COALESCE(SUM(quantity),0) AS n FROM collection_items`)
    .get().n;
  const salesYesterday = db
    .prepare(`SELECT COUNT(*) AS n FROM sales WHERE substr(created_at,1,10) = ?`)
    .get(yesterday).n;
  const totalSales = db.prepare(`SELECT COUNT(*) AS n FROM sales`).get().n;

  return {
    yesterday,
    hitsYesterday,
    topPages,
    trend,
    newUsers,
    totalUsers,
    verifiedUsers,
    loginsYesterday,
    activeSessions,
    collectors,
    totalCards,
    salesYesterday,
    totalSales,
  };
}

// Alte Zähler aufräumen (älter als 90 Tage).
export function pruneHits() {
  const cut = new Date();
  cut.setDate(cut.getDate() - 90);
  db.prepare(`DELETE FROM daily_hits WHERE day < ?`).run(ymd(cut));
}
