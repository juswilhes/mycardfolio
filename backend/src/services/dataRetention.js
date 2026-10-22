import db from "../db/index.js";
import { deleteAccount } from "./authService.js";
import { sendInactivityWarningMail } from "./mailer.js";
import { isOperatorUser } from "../lib/admin.js";

// Löschfristen (Art. 5 Abs. 1 lit. e DSGVO), läuft jede Nacht als erster Schritt des Nachtlaufs.
// Was hier steht, steht so auch in der Datenschutzerklärung (Ziffer 3 und 6) - bei Änderungen beide anpassen.
//   - abgelaufene Sitzungen und Fehlerberichte älter als 30 Tage
//   - nie bestätigte Konten ohne jeden Eintrag nach 30 Tagen (Tippfehler, Spam); wer etwas gesammelt
//     hat, bleibt, auch unbestätigt - unbestätigte Konten sind voll nutzbar
//   - drei Jahre inaktive Konten: erst eine Warnmail, gelöscht frühestens 30 Tage nach erfolgreichem Versand
//     (geht die Mail nicht raus, wird nicht gelöscht)
export const UNVERIFIED_DAYS = 30;
export const INACTIVE_YEARS = 3;
export const WARNING_DAYS = 30;

const unverifiedEmpty = db.prepare(`
  SELECT id, email FROM users u
  WHERE email_verified = 0
    AND created_at < datetime('now', '-${UNVERIFIED_DAYS} days')
    AND NOT EXISTS (SELECT 1 FROM collection_items WHERE user_id = u.id)
    AND NOT EXISTS (SELECT 1 FROM sales WHERE user_id = u.id)
    AND NOT EXISTS (SELECT 1 FROM sealed_products WHERE user_id = u.id)
    AND NOT EXISTS (SELECT 1 FROM watchlist_items WHERE user_id = u.id)
`);
const toWarn = db.prepare(`
  SELECT id, email FROM users
  WHERE last_seen_at < datetime('now', '-${INACTIVE_YEARS} years') AND inactivity_warned_at IS NULL
`);
const toDelete = db.prepare(`
  SELECT id, email FROM users
  WHERE last_seen_at < datetime('now', '-${INACTIVE_YEARS} years')
    AND inactivity_warned_at < datetime('now', '-${WARNING_DAYS} days')
`);
const markWarned = db.prepare(`UPDATE users SET inactivity_warned_at = datetime('now') WHERE id = ?`);

const dateDe = (d) => d.toLocaleDateString("de-DE", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Berlin" });

export async function runDataRetention() {
  const sessions = db.prepare(`DELETE FROM sessions WHERE expires_at < ?`).run(new Date().toISOString()).changes;
  const errors = db.prepare(`DELETE FROM client_errors WHERE created_at < datetime('now', '-30 days')`).run().changes;

  let unverified = 0;
  for (const u of unverifiedEmpty.all()) {
    if (isOperatorUser(u)) continue;
    deleteAccount(u.id);
    unverified++;
  }

  let inactive = 0;
  for (const u of toDelete.all()) {
    if (isOperatorUser(u)) continue;
    deleteAccount(u.id);
    inactive++;
  }

  let warned = 0;
  const deleteOn = dateDe(new Date(Date.now() + (WARNING_DAYS + 1) * 86400000));
  for (const u of toWarn.all()) {
    if (isOperatorUser(u)) continue;
    if (await sendInactivityWarningMail(u.email, deleteOn)) {
      markWarned.run(u.id);
      warned++;
    }
  }

  console.log(
    `[löschfristen] Sitzungen ${sessions}, Fehlerberichte ${errors}, unbestätigte leere Konten ${unverified}, ` +
      `Warnungen ${warned}, inaktive Konten gelöscht ${inactive}`
  );
}
