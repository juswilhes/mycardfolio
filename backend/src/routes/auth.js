import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import {
  validateRegistration,
  createUser,
  findUserByEmail,
  findUserById,
  checkPassword,
  createSession,
  endSession,
  endAllSessions,
  confirmEmail,
  newVerifyToken,
  startPasswordReset,
  completePasswordReset,
  setDisplayName,
  deleteAccount,
  exportUserData,
  publicUser,
} from "../services/authService.js";
import { sendVerificationMail, sendPasswordResetMail } from "../services/mailer.js";
import { authRequired, authOptional, SESSION_COOKIE } from "../middleware/auth.js";

const router = Router();

// Strengeres Limit für alles, was Brute-Force-Ziel sein könnte.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: Number(process.env.AUTH_RATE_LIMIT) || 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Zu viele Versuche – bitte später erneut probieren." },
});

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

// POST /api/auth/register  { email, password, displayName? }
router.post("/register", authLimiter, (req, res) => {
  const { email, password, displayName } = req.body ?? {};
  const err = validateRegistration({ email, password });
  if (err) return res.status(400).json({ error: err });

  const { user, verifyToken, error } = createUser({ email, password, displayName });
  if (error) return res.status(409).json({ error });

  sendVerificationMail(user.email, verifyToken);
  startSession(res, user, req);
  res.status(201).json({ user: publicUser(user) });
});

// POST /api/auth/login  { email, password }
router.post("/login", authLimiter, (req, res) => {
  const { email, password } = req.body ?? {};
  const user = findUserByEmail(email);
  if (!user || !checkPassword(user, password)) {
    return res.status(401).json({ error: "E-Mail oder Passwort ist falsch." });
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

// GET /api/auth/me  -> aktueller Nutzer oder null
router.get("/me", authOptional, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

// POST /api/auth/verify  { token }
router.post("/verify", (req, res) => {
  const { user, error } = confirmEmail(String(req.body?.token ?? ""));
  if (error) return res.status(400).json({ error });
  res.json({ user: publicUser(user) });
});

// POST /api/auth/resend-verification  (angemeldet)
router.post("/resend-verification", authRequired, (req, res) => {
  if (req.user.email_verified) return res.json({ ok: true });
  const t = newVerifyToken(req.user.id);
  sendVerificationMail(req.user.email, t);
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
  if (typeof password !== "string" || password.length < 8) {
    return res.status(400).json({ error: "Das Passwort muss mindestens 8 Zeichen lang sein." });
  }
  const { user, error } = completePasswordReset(String(token ?? ""), password);
  if (error) return res.status(400).json({ error });
  startSession(res, user, req);
  res.json({ user: publicUser(user) });
});

// PATCH /api/auth/me  { displayName }
router.patch("/me", authRequired, (req, res) => {
  const user = setDisplayName(req.user.id, req.body?.displayName ?? null);
  res.json({ user: publicUser(user) });
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
