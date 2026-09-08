import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import db from "../db/index.js";

const SESSION_DAYS = 30;
const RESET_TTL_MIN = 60;
const BCRYPT_ROUNDS = 10;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const token = (bytes = 32) => crypto.randomBytes(bytes).toString("base64url");
export const normEmail = (e) => String(e ?? "").trim().toLowerCase();

// --- Statements ----------------------------------------------------------
const sUserByEmail = db.prepare(`SELECT * FROM users WHERE email = ?`);
const sUserById = db.prepare(`SELECT * FROM users WHERE id = ?`);
const sUserByVerifyToken = db.prepare(`SELECT * FROM users WHERE verify_token = ?`);
const sUserByResetToken = db.prepare(`SELECT * FROM users WHERE reset_token = ?`);
const sInsertUser = db.prepare(`
  INSERT INTO users (email, password_hash, display_name, email_verified, verify_token, verify_sent_at)
  VALUES (@email, @hash, @display_name, 0, @verify_token, datetime('now'))
`);
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
const sSetDisplayName = db.prepare(`UPDATE users SET display_name = ? WHERE id = ?`);

const sInsertSession = db.prepare(`
  INSERT INTO sessions (token, user_id, user_agent, expires_at)
  VALUES (?, ?, ?, ?)
`);
const sSessionByToken = db.prepare(`SELECT * FROM sessions WHERE token = ?`);
const sDeleteSession = db.prepare(`DELETE FROM sessions WHERE token = ?`);
const sDeleteUserSessions = db.prepare(`DELETE FROM sessions WHERE user_id = ?`);

// --- Validierung -------------------------------------------------------
export function validateRegistration({ email, password }) {
  if (!EMAIL_RE.test(normEmail(email))) return "Bitte eine gültige E-Mail-Adresse angeben.";
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
    display_name: u.display_name || null,
    email_verified: !!u.email_verified,
  };
}

export const findUserByEmail = (email) => sUserByEmail.get(normEmail(email));
export const findUserById = (id) => sUserById.get(Number(id));

// --- Registrierung / Login -------------------------------------------
export function createUser({ email, password, displayName }) {
  const e = normEmail(email);
  if (sUserByEmail.get(e)) return { error: "Diese E-Mail-Adresse ist bereits registriert." };
  const verify_token = token(24);
  const info = sInsertUser.run({
    email: e,
    hash: bcrypt.hashSync(password, BCRYPT_ROUNDS),
    display_name: displayName ? String(displayName).trim().slice(0, 60) || null : null,
    verify_token,
  });
  return { user: sUserById.get(info.lastInsertRowid), verifyToken: verify_token };
}

export function checkPassword(user, password) {
  if (!user?.password_hash) return false;
  try {
    return bcrypt.compareSync(String(password ?? ""), user.password_hash);
  } catch {
    return false;
  }
}

// --- Sessions --------------------------------------------------------
export function createSession(userId, userAgent = "") {
  const t = token(32);
  const expires = new Date(Date.now() + SESSION_DAYS * 86400000).toISOString();
  sInsertSession.run(t, userId, String(userAgent).slice(0, 255), expires);
  return { token: t, expiresMs: SESSION_DAYS * 86400000 };
}

export function userForSession(t) {
  if (!t) return null;
  const s = sSessionByToken.get(t);
  if (!s) return null;
  if (new Date(s.expires_at).getTime() < Date.now()) {
    sDeleteSession.run(t);
    return null;
  }
  return sUserById.get(s.user_id) || null;
}

export const endSession = (t) => t && sDeleteSession.run(t);
export const endAllSessions = (userId) => sDeleteUserSessions.run(userId);

// --- E-Mail-Bestätigung --------------------------------------------
export function confirmEmail(verifyToken) {
  const u = sUserByVerifyToken.get(verifyToken);
  if (!u) return { error: "Der Bestätigungslink ist ungültig oder wurde bereits verwendet." };
  sSetVerified.run(u.id);
  return { user: sUserById.get(u.id) };
}

export function newVerifyToken(userId) {
  const t = token(24);
  sSetVerifyToken.run(t, userId);
  return t;
}

// --- Passwort-Reset ----------------------------------------------
export function startPasswordReset(email) {
  const u = sUserByEmail.get(normEmail(email));
  if (!u) return null; // absichtlich keine Rückmeldung, ob die Adresse existiert
  const t = token(24);
  const expires = new Date(Date.now() + RESET_TTL_MIN * 60000).toISOString();
  sSetResetToken.run(t, expires, u.id);
  return { user: u, resetToken: t };
}

export function completePasswordReset(resetToken, password) {
  const u = sUserByResetToken.get(resetToken);
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

export function setDisplayName(userId, name) {
  sSetDisplayName.run(name ? String(name).trim().slice(0, 60) || null : null, userId);
  return sUserById.get(userId);
}

// --- Konto löschen (DSGVO) -----------------------------------------
export function deleteAccount(userId) {
  const tx = db.transaction(() => {
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
      display_name: u.display_name,
      email_verified: !!u.email_verified,
      created_at: u.created_at,
    },
    collection: db
      .prepare(
        `SELECT ci.*, c.external_id, c.name, c.set_name, c.number
         FROM collection_items ci JOIN cards c ON c.id = ci.card_id
         WHERE ci.user_id = ? ORDER BY ci.id`
      )
      .all(userId),
    sales: db.prepare(`SELECT * FROM sales WHERE user_id = ? ORDER BY id`).all(userId),
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
