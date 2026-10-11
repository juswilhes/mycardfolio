import db from "../db/index.js";
import { OPERATOR_EMAIL } from "../lib/admin.js";

const ymd = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;

const one = (sql, ...args) => db.prepare(sql).get(...args).n;

// ID des Betreiber-Kontos (aus OPERATOR_EMAIL). -1 = keins -> filtert nichts.
const adminId =
  db.prepare(`SELECT id FROM users WHERE lower(email) = ?`).get(OPERATOR_EMAIL || " ")?.id ?? -1;

// Kennzahlen fuer den Tagesbericht - die eigene Aktivitaet des Betreibers
// (Konto + als Admin gezaehlte Zugriffe) ist herausgerechnet.
// "Gestern" = voriger Kalendertag (Serverzeit).
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
  const humOn = (day) => one(`SELECT COUNT(*) n FROM daily_humans WHERE day = ?`, day);
  const botsOn = (day) => one(`SELECT COALESCE(SUM(n),0) n FROM daily_stat WHERE day = ? AND key = 'bot_hits'`, day);
  // Menschenzählung gibt es erst ab dem ersten Ping: davor "unbekannt" statt einer falschen 0
  const humansSince = db.prepare(`SELECT MIN(day) d FROM daily_humans`).get().d;
  const humOrNull = (day) => (humansSince && day >= humansSince ? humOn(day) : null);

  return {
    yesterday,
    adminFiltered: adminId !== -1,

    newUsers: one(
      `SELECT COUNT(*) n FROM users WHERE substr(created_at,1,10) = ? AND id != ?`,
      yesterday,
      adminId
    ),
    otherUsers: one(`SELECT COUNT(*) n FROM users WHERE id != ?`, adminId),
    verifiedUsers: one(
      `SELECT COUNT(*) n FROM users WHERE email_verified = 1 AND id != ?`,
      adminId
    ),

    humans: humOrNull(yesterday),
    botHits: botsOn(yesterday),
    visitors: visOn(yesterday),
    hits: hitsOn(yesterday),
    logins: one(
      `SELECT COUNT(*) n FROM sessions WHERE substr(created_at,1,10) = ? AND user_id != ?`,
      yesterday,
      adminId
    ),
    activeCollectors: one(
      `SELECT COUNT(DISTINCT user_id) n FROM collection_items WHERE substr(created_at,1,10) = ? AND user_id != ?`,
      yesterday,
      adminId
    ),
    cardsAddedYesterday: one(
      `SELECT COALESCE(SUM(quantity),0) n FROM collection_items WHERE substr(created_at,1,10) = ? AND user_id != ?`,
      yesterday,
      adminId
    ),

    errors5xx: one(
      `SELECT COALESCE(SUM(n),0) n FROM daily_stat WHERE day = ? AND key = '5xx'`,
      yesterday
    ),

    activeSessions: one(
      `SELECT COUNT(*) n FROM sessions WHERE expires_at > datetime('now') AND user_id != ?`,
      adminId
    ),
    collectors: one(
      `SELECT COUNT(DISTINCT user_id) n FROM collection_items WHERE user_id != ?`,
      adminId
    ),
    totalCards: one(
      `SELECT COALESCE(SUM(quantity),0) n FROM collection_items WHERE user_id != ?`,
      adminId
    ),

    topPages: db
      .prepare(`SELECT path, hits FROM daily_hits WHERE day = ? ORDER BY hits DESC LIMIT 6`)
      .all(yesterday),

    trend: days7.map((day) => ({ day, hits: hitsOn(day), visitors: visOn(day), humans: humOrNull(day) })),
  };
}

// Alte Zaehler aufraeumen: Aufrufe/Fehler 90 Tage, Besucher-Hashes 7 Tage.
export function pruneStats() {
  const cut = (n) => {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return ymd(d);
  };
  db.prepare(`DELETE FROM daily_hits WHERE day < ?`).run(cut(90));
  db.prepare(`DELETE FROM daily_stat WHERE day < ?`).run(cut(90));
  db.prepare(`DELETE FROM daily_visitors WHERE day < ?`).run(cut(7));
  db.prepare(`DELETE FROM daily_humans WHERE day < ?`).run(cut(7));
}
