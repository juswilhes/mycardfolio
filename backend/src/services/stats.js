import db from "../db/index.js";

const ymd = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;

const one = (sql, ...args) => db.prepare(sql).get(...args).n;

// Kennzahlen für den Tagesbericht. "Gestern" = voriger Kalendertag
// (Serverzeit). created_at ist UTC – bei Serverzeit Europe/Berlin weicht
// das nur in den ersten Nachtstunden ab, für einen Tagesüberblick egal.
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

  const hitsOn = (day) => one(`SELECT COALESCE(SUM(hits),0) n FROM daily_hits WHERE day = ?`, day);
  const visOn = (day) => one(`SELECT COUNT(*) n FROM daily_visitors WHERE day = ?`, day);

  return {
    yesterday,

    // Wachstum
    newUsers: one(`SELECT COUNT(*) n FROM users WHERE substr(created_at,1,10) = ?`, yesterday),
    totalUsers: one(`SELECT COUNT(*) n FROM users`),
    verifiedUsers: one(`SELECT COUNT(*) n FROM users WHERE email_verified = 1`),

    // Nutzung gestern
    visitors: visOn(yesterday),
    hits: hitsOn(yesterday),
    logins: one(`SELECT COUNT(*) n FROM sessions WHERE substr(created_at,1,10) = ?`, yesterday),
    activeCollectors: one(
      `SELECT COUNT(DISTINCT user_id) n FROM collection_items WHERE substr(created_at,1,10) = ?`,
      yesterday
    ),
    cardsAddedYesterday: one(
      `SELECT COALESCE(SUM(quantity),0) n FROM collection_items WHERE substr(created_at,1,10) = ?`,
      yesterday
    ),

    // Gesundheit
    errors5xx: one(`SELECT COALESCE(SUM(n),0) n FROM daily_stat WHERE day = ? AND key = '5xx'`, yesterday),

    // Stand jetzt
    activeSessions: one(`SELECT COUNT(*) n FROM sessions WHERE expires_at > datetime('now')`),
    collectors: one(`SELECT COUNT(DISTINCT user_id) n FROM collection_items`),
    totalCards: one(`SELECT COALESCE(SUM(quantity),0) n FROM collection_items`),

    // Top-Seiten gestern
    topPages: db
      .prepare(`SELECT path, hits FROM daily_hits WHERE day = ? ORDER BY hits DESC LIMIT 6`)
      .all(yesterday),

    // 7-Tage-Verlauf
    trend: days7.map((day) => ({ day, hits: hitsOn(day), visitors: visOn(day) })),
  };
}

// Alte Zähler aufräumen: Seitenaufrufe/Fehler 90 Tage, Besucher-Hashes 7 Tage.
export function pruneStats() {
  const cut = (n) => {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return ymd(d);
  };
  db.prepare(`DELETE FROM daily_hits WHERE day < ?`).run(cut(90));
  db.prepare(`DELETE FROM daily_stat WHERE day < ?`).run(cut(90));
  db.prepare(`DELETE FROM daily_visitors WHERE day < ?`).run(cut(7));
}
