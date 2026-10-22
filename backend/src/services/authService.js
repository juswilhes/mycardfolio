import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import db from "../db/index.js";
import { isOperatorUser } from "../lib/admin.js";

const SESSION_DAYS = 30;
const RESET_TTL_MIN = 60;
const BCRYPT_ROUNDS = 10;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const token = (bytes = 32) => crypto.randomBytes(bytes).toString("base64url");

// Sitzungs-, Bestätigungs- und Reset-Token liegen NUR als SHA-256-Hash in der
// Datenbank. Die Klartext-Werte kennen nur Cookie bzw. Mail-Link - ein Leck
// der Datenbank (Backup, SQL-Fehler) erlaubt so weder Sitzungsübernahme noch
// Passwort-Reset. Die Token sind zufällig und lang (192-256 Bit), ein
// schneller Hash reicht deshalb (anders als bei Passwörtern).
const hashToken = (t) => crypto.createHash("sha256").update(String(t)).digest("hex");

// Einmalige Umstellung: bisher im Klartext gespeicherte Token in Hashes
// überführen (Länge 64 = schon Hash). Laufende Sitzungen bleiben gültig,
// weil beim Prüfen das Cookie ebenfalls gehasht wird.
db.transaction(() => {
  for (const r of db.prepare(`SELECT token FROM sessions WHERE length(token) != 64`).all()) {
    db.prepare(`UPDATE sessions SET token = ? WHERE token = ?`).run(hashToken(r.token), r.token);
  }
  for (const col of ["verify_token", "reset_token"]) {
    for (const r of db.prepare(`SELECT id, ${col} AS t FROM users WHERE ${col} IS NOT NULL AND length(${col}) != 64`).all()) {
      db.prepare(`UPDATE users SET ${col} = ? WHERE id = ?`).run(hashToken(r.t), r.id);
    }
  }
  db.prepare(`DELETE FROM sessions WHERE expires_at < ?`).run(new Date().toISOString());
  // Fehlerberichte aus dem Browser (mit E-Mail, Browserkennung) nur 30 Tage aufbewahren - so steht es
  // in der Datenschutzerklärung. Läuft bei jedem Start, also nach jedem Deploy.
  db.prepare(`DELETE FROM client_errors WHERE created_at < datetime('now', '-30 days')`).run();
  // Reste früher gelöschter Konten (die Löschung erfasste diese Tabellen anfangs nicht)
  for (const t of ["watchlist_items", "sealed_products", "user_achievements"]) {
    db.prepare(`DELETE FROM ${t} WHERE user_id NOT IN (SELECT id FROM users)`).run();
  }
})();
const normEmail = (e) => String(e ?? "").trim().toLowerCase();

// --- Statements ----------------------------------------------------------
const sUserByEmail = db.prepare(`SELECT * FROM users WHERE email = ?`);
const sUserById = db.prepare(`SELECT * FROM users WHERE id = ?`);
const sUserByVerifyToken = db.prepare(`SELECT * FROM users WHERE verify_token = ?`);
const sUserByResetToken = db.prepare(`SELECT * FROM users WHERE reset_token = ?`);
const sInsertUser = db.prepare(`
  INSERT INTO users (email, password_hash, username, email_verified, verify_token, verify_sent_at, welcome_optin_at)
  VALUES (@email, @hash, @username, 0, @verify_token, datetime('now'), CASE WHEN @welcome THEN datetime('now') END)
`);
const sUserByUsername = db.prepare(`SELECT id FROM users WHERE username = ? COLLATE NOCASE`);
const sSetPassword = db.prepare(
  `UPDATE users SET password_hash = ?, reset_token = NULL, reset_expires = NULL WHERE id = ?`
);
const sSetVerified = db.prepare(
  `UPDATE users SET email_verified = 1, verify_token = NULL WHERE id = ?`
);
const sSetVerifyToken = db.prepare(
  `UPDATE users SET verify_token = ?, verify_sent_at = datetime('now') WHERE id = ?`
);
const sSetResetToken = db.prepare(
  `UPDATE users SET reset_token = ?, reset_expires = ? WHERE id = ?`
);
const sSetUsername = db.prepare(`UPDATE users SET username = ? WHERE id = ?`);

const sInsertSession = db.prepare(`
  INSERT INTO sessions (token, user_id, user_agent, expires_at)
  VALUES (?, ?, ?, ?)
`);
const sSessionByToken = db.prepare(`SELECT * FROM sessions WHERE token = ?`);
const sDeleteSession = db.prepare(`DELETE FROM sessions WHERE token = ?`);
const sDeleteUserSessions = db.prepare(`DELETE FROM sessions WHERE user_id = ?`);

// --- Validierung -------------------------------------------------------
// Benutzername: 3-20 Zeichen, Buchstaben (ohne Umlaute), Ziffern, Punkt, Unterstrich, Bindestrich;
// beginnt mit Buchstabe oder Ziffer. Einige Namen sind reserviert (Verwechslung mit dem Betreiber).
const USERNAME_RE = /^[A-Za-z0-9][A-Za-z0-9_.-]{2,19}$/;
const RESERVED = new Set(["admin", "administrator", "mycardfolio", "support", "info", "root", "moderator", "mod", "betreiber", "system", "team", "justus"]);
export function validateUsername(name) {
  const n = String(name ?? "").trim();
  if (!USERNAME_RE.test(n))
    return "Der Benutzername braucht 3 bis 20 Zeichen: Buchstaben, Ziffern, Punkt, Unterstrich oder Bindestrich (ohne Leerzeichen und Umlaute).";
  if (RESERVED.has(n.toLowerCase())) return "Dieser Benutzername ist reserviert.";
  return null;
}

export function validateRegistration({ email, password, username }) {
  if (!EMAIL_RE.test(normEmail(email))) return "Bitte eine gültige E-Mail-Adresse angeben.";
  const nameErr = validateUsername(username);
  if (nameErr) return nameErr;
  if (typeof password !== "string" || password.length < 8)
    return "Das Passwort muss mindestens 8 Zeichen lang sein.";
  if (password.length > 200) return "Das Passwort ist zu lang.";
  return null;
}

// --- Public-Sicht eines Users (nie Hash/Token nach draußen) -----------
export function publicUser(u) {
  if (!u) return null;
  return {
    id: u.id,
    email: u.email,
    username: u.username || null,
    email_verified: !!u.email_verified,
    is_operator: isOperatorUser(u),
  };
}

export const findUserByEmail = (email) => sUserByEmail.get(normEmail(email));
export const findUserById = (id) => sUserById.get(Number(id));

// --- Registrierung / Login -------------------------------------------
export function createUser({ email, password, username, welcome = false }) {
  const e = normEmail(email);
  const n = String(username).trim();
  if (sUserByEmail.get(e)) return { error: "Diese E-Mail-Adresse ist bereits registriert." };
  if (sUserByUsername.get(n)) return { error: "Dieser Benutzername ist schon vergeben." };
  const verify_token = token(24);
  const info = sInsertUser.run({
    email: e,
    hash: bcrypt.hashSync(password, BCRYPT_ROUNDS),
    username: n,
    verify_token: hashToken(verify_token),
    welcome: welcome ? 1 : 0,
  });
  return { user: sUserById.get(info.lastInsertRowid), verifyToken: verify_token };
}

// Gegen diesen Hash wird verglichen, wenn die E-Mail gar nicht existiert -
// sonst wäre "unbekannte Adresse" messbar schneller (bcrypt entfällt) und
// verriete, welche Adressen registriert sind.
const DUMMY_HASH = bcrypt.hashSync("nicht-das-passwort-von-irgendwem", BCRYPT_ROUNDS);

export function checkPassword(user, password) {
  const hash = user?.password_hash || DUMMY_HASH;
  let ok = false;
  try {
    ok = bcrypt.compareSync(String(password ?? ""), hash);
  } catch {
    ok = false;
  }
  return !!user?.password_hash && ok;
}

// --- Kontosperre ---------------------------------------------------------
const MAX_FAILED_LOGINS = 5;
const LOCK_MINUTES = 15;

export const isLocked = (user) => !!user?.locked_until && new Date(user.locked_until).getTime() > Date.now();

// Fehlversuch zählen; ab MAX_FAILED_LOGINS wird das Konto LOCK_MINUTES gesperrt.
// Das IP-Limit allein reicht nicht: ein Angreifer mit vielen IPs könnte sonst
// beliebig viele Passwörter für ein Konto durchprobieren. (Passwort-Reset
// bleibt auch bei Sperre möglich.)
export function registerFailedLogin(userId) {
  const u = sUserById.get(userId);
  const n = (u?.failed_logins ?? 0) + 1;
  if (n >= MAX_FAILED_LOGINS) {
    const until = new Date(Date.now() + LOCK_MINUTES * 60000).toISOString();
    db.prepare(`UPDATE users SET failed_logins = 0, locked_until = ? WHERE id = ?`).run(until, userId);
  } else {
    db.prepare(`UPDATE users SET failed_logins = ? WHERE id = ?`).run(n, userId);
  }
}

export function resetFailedLogins(userId) {
  db.prepare(`UPDATE users SET failed_logins = 0, locked_until = NULL WHERE id = ?`).run(userId);
}

// Fassung der Nutzungsbedingungen (frontend/src/pages/Nutzungsbedingungen.jsx); bei inhaltlicher Änderung hochsetzen.
export const TERMS_VERSION = "2026-10-22";
export function recordTermsAcceptance(userId) {
  db.prepare(`UPDATE users SET terms_accepted_at = datetime('now'), terms_version = ? WHERE id = ?`).run(TERMS_VERSION, userId);
}

// --- Sessions --------------------------------------------------------
// Höchstens einmal am Tag schreiben; wer wieder aktiv ist, verliert eine Löschwarnung.
const sTouchUser = db.prepare(
  `UPDATE users SET last_seen_at = datetime('now'), inactivity_warned_at = NULL
   WHERE id = ? AND (last_seen_at IS NULL OR last_seen_at < datetime('now', '-1 day') OR inactivity_warned_at IS NOT NULL)`
);

export function createSession(userId, userAgent = "") {
  sTouchUser.run(userId);
  const t = token(32);
  const expires = new Date(Date.now() + SESSION_DAYS * 86400000).toISOString();
  sInsertSession.run(hashToken(t), userId, String(userAgent).slice(0, 255), expires);
  return { token: t, expiresMs: SESSION_DAYS * 86400000 };
}

export function userForSession(t) {
  if (!t) return null;
  const h = hashToken(t);
  const s = sSessionByToken.get(h);
  if (!s) return null;
  if (new Date(s.expires_at).getTime() < Date.now()) {
    sDeleteSession.run(h);
    return null;
  }
  const u = sUserById.get(s.user_id);
  // Ohne bestätigte E-Mail-Adresse gibt es keine Anmeldung (auch keine alte Sitzung)
  if (!u || !u.email_verified) return null;
  sTouchUser.run(u.id);
  return u;
}

export const endSession = (t) => t && sDeleteSession.run(hashToken(t));

// --- E-Mail-Bestätigung --------------------------------------------
const VERIFY_TTL_DAYS = 7;
export function confirmEmail(verifyToken) {
  const u = sUserByVerifyToken.get(hashToken(verifyToken));
  if (!u) return { error: "Der Bestätigungslink ist ungültig oder wurde bereits verwendet." };
  if (!u.verify_sent_at || Date.parse(u.verify_sent_at.replace(" ", "T") + "Z") < Date.now() - VERIFY_TTL_DAYS * 86400000) {
    return { error: "Der Bestätigungslink ist abgelaufen. Fordere bei der Anmeldung einen neuen an.", expired: true };
  }
  sSetVerified.run(u.id);
  return { user: sUserById.get(u.id) };
}

// Neuer Bestätigungslink per E-Mail-Adresse (ohne Anmeldung). Gibt null zurück, wenn es kein
// unbestätigtes Konto zu der Adresse gibt - die Route antwortet trotzdem immer gleich.
export function verifyTokenForEmail(email) {
  const u = sUserByEmail.get(normEmail(email));
  if (!u || u.email_verified) return null;
  return { user: u, token: newVerifyToken(u.id) };
}

export function newVerifyToken(userId) {
  const t = token(24);
  sSetVerifyToken.run(hashToken(t), userId);
  return t;
}

// --- Passwort-Reset ----------------------------------------------
export function startPasswordReset(email) {
  const u = sUserByEmail.get(normEmail(email));
  if (!u) return null; // absichtlich keine Rückmeldung, ob die Adresse existiert
  const t = token(24);
  const expires = new Date(Date.now() + RESET_TTL_MIN * 60000).toISOString();
  sSetResetToken.run(hashToken(t), expires, u.id);
  return { user: u, resetToken: t };
}

export function completePasswordReset(resetToken, password) {
  const u = sUserByResetToken.get(hashToken(resetToken));
  if (!u || !u.reset_expires || new Date(u.reset_expires).getTime() < Date.now()) {
    return { error: "Der Link ist ungültig oder abgelaufen." };
  }
  const tx = db.transaction(() => {
    sSetPassword.run(bcrypt.hashSync(String(password), BCRYPT_ROUNDS), u.id);
    if (!u.email_verified) sSetVerified.run(u.id); // Reset über Mail belegt die Adresse
    sDeleteUserSessions.run(u.id); // alle anderen Sitzungen beenden
  });
  tx();
  return { user: sUserById.get(u.id) };
}

export function setUsername(userId, name) {
  const err = validateUsername(name);
  if (err) return { error: err };
  const n = String(name).trim();
  const other = sUserByUsername.get(n);
  if (other && other.id !== userId) return { error: "Dieser Benutzername ist schon vergeben." };
  sSetUsername.run(n, userId);
  return { user: sUserById.get(userId) };
}

// --- Konto löschen (DSGVO) -----------------------------------------
// Alle Tabellen mit Nutzerbezug - neue Tabelle mit user_id = auch hier eintragen (Löschung nach
// Art. 17 DSGVO, die Datenschutzerklärung verspricht "unwiderruflich entfernt").
export function deleteAccount(userId) {
  const email = sUserById.get(userId)?.email;
  const tx = db.transaction(() => {
    for (const t of ["watchlist_items", "sealed_products", "user_achievements"]) {
      db.prepare(`DELETE FROM ${t} WHERE user_id = ?`).run(userId);
    }
    if (email) db.prepare(`DELETE FROM client_errors WHERE user_email = ?`).run(email);
    db.prepare(`DELETE FROM collection_items WHERE user_id = ?`).run(userId);
    db.prepare(`DELETE FROM sales WHERE user_id = ?`).run(userId);
    db.prepare(`DELETE FROM portfolio_snapshots WHERE user_id = ?`).run(userId);
    db.prepare(`DELETE FROM sessions WHERE user_id = ?`).run(userId);
    db.prepare(`DELETE FROM users WHERE id = ?`).run(userId);
  });
  tx();
}

// --- Datenexport (DSGVO Art. 20) ---------------------------------
export function exportUserData(userId) {
  const u = sUserById.get(userId);
  return {
    exported_at: new Date().toISOString(),
    account: {
      email: u.email,
      username: u.username,
      welcome_optin_at: u.welcome_optin_at ?? null,
      email_verified: !!u.email_verified,
      created_at: u.created_at,
      terms_accepted_at: u.terms_accepted_at ?? null,
      terms_version: u.terms_version ?? null,
    },
    collection: db
      .prepare(
        `SELECT ci.*, c.external_id, c.name, c.set_name, c.number
         FROM collection_items ci JOIN cards c ON c.id = ci.card_id
         WHERE ci.user_id = ? ORDER BY ci.id`
      )
      .all(userId),
    sales: db.prepare(`SELECT * FROM sales WHERE user_id = ? ORDER BY id`).all(userId),
    sealed_products: db.prepare(`SELECT * FROM sealed_products WHERE user_id = ? ORDER BY id`).all(userId),
    watchlist: db
      .prepare(
        `SELECT w.*, c.external_id, c.name, c.set_name, c.number
         FROM watchlist_items w JOIN cards c ON c.id = w.card_id WHERE w.user_id = ?`
      )
      .all(userId),
    achievements: db.prepare(`SELECT achievement_id, earned_at FROM user_achievements WHERE user_id = ?`).all(userId),
    portfolio_history: db
      .prepare(
        `SELECT captured_on, total_value, total_cost, card_count
         FROM portfolio_snapshots WHERE user_id = ? ORDER BY captured_on`
      )
      .all(userId),
  };
}

export const listUserIds = () =>
  db.prepare(`SELECT id FROM users`).all().map((r) => r.id);
