import { Router } from "express";
import db from "../db/index.js";
import { userForSession } from "../services/authService.js";
import { SESSION_COOKIE } from "../middleware/auth.js";

const router = Router();

const insertError = db.prepare(`
  INSERT INTO client_errors (message, stack, url, user_email, user_agent)
  VALUES (?, ?, ?, ?, ?)
`);

// POST /api/client-error - meldet einen unbehandelten JS-Fehler aus dem
// Browser. Bewusst ohne Login-Pflicht (ein Fehler kann auch VOR dem Login
// auftreten) und ohne die Anfrage je scheitern zu lassen.
router.post("/", (req, res) => {
  try {
    const { message, stack, url, componentStack } = req.body || {};
    const user = userForSession(req.cookies?.[SESSION_COOKIE]);
    const fullStack = [stack, componentStack].filter(Boolean).join("\n---component stack---\n");
    insertError.run(
      String(message ?? "").slice(0, 500),
      fullStack.slice(0, 4000),
      String(url ?? "").slice(0, 300),
      user?.email ?? null,
      String(req.headers["user-agent"] ?? "").slice(0, 300)
    );
  } catch {
    /* Fehler-Meldung darf selbst nie einen Fehler werfen */
  }
  res.status(204).end();
});

export default router;
