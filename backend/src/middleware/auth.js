import { userForSession } from "../services/authService.js";

export const SESSION_COOKIE = "mcf_session";

// Hängt req.user an, wenn ein gültiges Session-Cookie da ist (sonst null).
export function authOptional(req, _res, next) {
  req.user = userForSession(req.cookies?.[SESSION_COOKIE]) || null;
  next();
}

// Blockt ohne gültige Sitzung mit 401.
export function authRequired(req, res, next) {
  const user = userForSession(req.cookies?.[SESSION_COOKIE]);
  if (!user) return res.status(401).json({ error: "Bitte zuerst anmelden." });
  req.user = user;
  next();
}
