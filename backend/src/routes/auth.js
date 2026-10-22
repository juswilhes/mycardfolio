import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import {
  validateRegistration,
  createUser,
  findUserByEmail,
  findUserById,
  checkPassword,
  isLocked,
  registerFailedLogin,
  resetFailedLogins,
  createSession,
  endSession,
  confirmEmail,
  startPasswordReset,
  completePasswordReset,
  setUsername,
  setNewsletter,
  unsubscribeToken,
  unsubscribeByToken,
  verifyTokenForEmail,
  deleteAccount,
  exportUserData,
  publicUser,
  recordTermsAcceptance,
} from "../services/authService.js";
import { sendVerificationMail, sendPasswordResetMail, sendWelcomeMail } from "../services/mailer.js";
import { authRequired, authOptional, SESSION_COOKIE } from "../middleware/auth.js";

const router = Router();
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

// Strengeres Limit für alles, was Brute-Force-Ziel sein könnte.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: Number(process.env.AUTH_RATE_LIMIT) || 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Zu viele Versuche – bitte später erneut probieren." },
});

// Registrierung offen? Über REGISTRATION_OPEN=false in der .env schließbar.
const registrationOpen = () => process.env.REGISTRATION_OPEN !== "false";

const cookieOpts = () => ({
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  path: "/",
});

function startSession(res, user, req) {
  const { token, expiresMs } = createSession(user.id, req.get("user-agent"));
  res.cookie(SESSION_COOKIE, token, { ...cookieOpts(), maxAge: expiresMs });
}

// POST /api/auth/register  { email, password, username, acceptTerms, newsletter? }
// Legt das Konto an und schickt den Bestätigungslink - angemeldet wird erst nach der Bestätigung.
router.post("/register", authLimiter, (req, res) => {
  if (!registrationOpen()) {
    return res.status(403).json({ error: "Die Registrierung ist gerade geschlossen." });
  }
  const { email, password, username, acceptTerms, newsletter } = req.body ?? {};
  const err = validateRegistration({ email, password, username });
  if (err) return res.status(400).json({ error: err });
  if (acceptTerms !== true) return res.status(400).json({ error: "Bitte akzeptiere die Nutzungsbedingungen." });

  const { user, verifyToken, error } = createUser({ email, password, username, newsletter: newsletter === true });
  if (error) return res.status(409).json({ error });
  recordTermsAcceptance(user.id);

  sendVerificationMail(user.email, verifyToken, { newsletter: !!user.newsletter_optin_at });
  res.status(201).json({ pending: true, email: user.email });
});

// POST /api/auth/login  { email, password }
router.post("/login", authLimiter, (req, res) => {
  const { email, password } = req.body ?? {};
  const user = findUserByEmail(email);
  if (isLocked(user)) {
    return res.status(429).json({
      error: "Zu viele Fehlversuche. Bitte in 15 Minuten erneut probieren oder das Passwort zurücksetzen.",
    });
  }
  if (!checkPassword(user, password)) {
    if (user) registerFailedLogin(user.id);
    return res.status(401).json({ error: "E-Mail oder Passwort ist falsch." });
  }
  resetFailedLogins(user.id);
  if (!user.email_verified) {
    return res.status(403).json({
      error: "Bitte bestätige zuerst deine E-Mail-Adresse. Den Link haben wir dir bei der Registrierung geschickt.",
      needsVerification: true,
    });
  }
  startSession(res, user, req);
  res.json({ user: publicUser(user) });
});

// POST /api/auth/logout
router.post("/logout", (req, res) => {
  endSession(req.cookies?.[SESSION_COOKIE]);
  res.clearCookie(SESSION_COOKIE, cookieOpts());
  res.json({ ok: true });
});

// GET /api/auth/me  -> aktueller Nutzer (oder null) + ob Registrierung offen ist
router.get("/me", authOptional, (req, res) => {
  res.json({ user: publicUser(req.user), registrationOpen: registrationOpen() });
});

// POST /api/auth/verify  { token }
router.post("/verify", (req, res) => {
  const { user, error, expired } = confirmEmail(String(req.body?.token ?? ""));
  if (error) return res.status(400).json({ error, expired: !!expired });
  // Nur hier und nur mit bestätigter Einwilligung (Double-Opt-in); ein Bestätigungslink gilt genau einmal
  if (user.newsletter_optin_at && user.newsletter_confirmed_at) {
    sendWelcomeMail(user, `${FRONTEND_URL}/abmelden?t=${encodeURIComponent(unsubscribeToken(user.id))}`);
  }
  startSession(res, user, req);
  res.json({ user: publicUser(user) });
});

// POST /api/auth/resend-verification  { email } - neuer Bestätigungslink ohne Anmeldung.
// Immer gleiche Antwort - verrät nicht, ob es zu der Adresse ein Konto gibt.
router.post("/resend-verification", authLimiter, (req, res) => {
  const r = verifyTokenForEmail(String(req.body?.email ?? ""));
  if (r) sendVerificationMail(r.user.email, r.token, { newsletter: !!r.user.newsletter_optin_at });
  res.json({ ok: true });
});

// POST /api/auth/request-reset  { email }
router.post("/request-reset", authLimiter, (req, res) => {
  const result = startPasswordReset(String(req.body?.email ?? ""));
  if (result) sendPasswordResetMail(result.user.email, result.resetToken);
  // Immer gleiche Antwort – verrät nicht, ob die Adresse existiert.
  res.json({ ok: true });
});

// POST /api/auth/reset  { token, password }
router.post("/reset", authLimiter, (req, res) => {
  const { token, password } = req.body ?? {};
  if (typeof password !== "string") return res.status(400).json({ error: "Bitte ein neues Passwort angeben." });
  const { user, error } = completePasswordReset(String(token ?? ""), password);
  if (error) return res.status(400).json({ error });
  startSession(res, user, req);
  res.json({ user: publicUser(user) });
});

// PATCH /api/auth/me  { username } oder { newsletter: true|false }
router.patch("/me", authRequired, (req, res) => {
  if (typeof req.body?.newsletter === "boolean") {
    return res.json({ user: publicUser(setNewsletter(req.user.id, req.body.newsletter)) });
  }
  const { user, error } = setUsername(req.user.id, req.body?.username);
  if (error) return res.status(400).json({ error });
  res.json({ user: publicUser(user) });
});

// POST /api/auth/unsubscribe  { token } - Abmeldelink aus E-Mails, ohne Anmeldung
router.post("/unsubscribe", authLimiter, (req, res) => {
  if (!unsubscribeByToken(req.body?.token)) return res.status(400).json({ error: "Der Abmeldelink ist ungültig." });
  res.json({ ok: true });
});

// GET /api/auth/export  -> vollständiger Datenexport (DSGVO Art. 20)
router.get("/export", authRequired, (req, res) => {
  res.setHeader("Content-Disposition", 'attachment; filename="mycardfolio-export.json"');
  res.json(exportUserData(req.user.id));
});

// DELETE /api/auth/account  { password }
router.delete("/account", authRequired, (req, res) => {
  const fresh = findUserById(req.user.id);
  // Konten mit Passwort: zur Sicherheit noch einmal bestätigen lassen.
  if (fresh.password_hash && !checkPassword(fresh, req.body?.password)) {
    return res.status(403).json({ error: "Passwort stimmt nicht." });
  }
  deleteAccount(req.user.id);
  res.clearCookie(SESSION_COOKIE, cookieOpts());
  res.json({ ok: true });
});

export default router;
