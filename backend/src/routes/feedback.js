import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { authOptional } from "../middleware/auth.js";
import { sendFeedbackMail } from "../services/mailer.js";

// POST /api/feedback { message, email?, page? } - Feedback-Knopf (components/FeedbackButton.jsx).
// Die Nachricht geht nur per E-Mail an den Betreiber, in der Datenbank wird nichts gespeichert
// (so steht es in der Datenschutzerklärung, Ziffer 10). "website" ist ein unsichtbares Lockfeld:
// Menschen lassen es leer, einfache Spam-Roboter füllen es aus.
const router = Router();

const limiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Du hast gerade viel Feedback geschickt - bitte versuch es später noch einmal." },
});

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.post("/", limiter, authOptional, async (req, res) => {
  const { message, email, page, website } = req.body ?? {};
  if (website) return res.json({ ok: true });
  const text = String(message ?? "").trim();
  if (text.length < 5) return res.status(400).json({ error: "Bitte schreib ein paar Worte mehr." });
  if (text.length > 3000) return res.status(400).json({ error: "Die Nachricht ist zu lang (höchstens 3.000 Zeichen)." });
  const given = String(email ?? "").trim();
  if (given && (given.length > 200 || !EMAIL.test(given))) {
    return res.status(400).json({ error: "Die E-Mail-Adresse sieht nicht gültig aus." });
  }
  const ok = await sendFeedbackMail({
    message: text,
    email: req.user?.email ?? (given || null),
    loggedIn: !!req.user,
    page: String(page ?? "").slice(0, 300),
  });
  if (!ok) {
    return res.status(502).json({ error: "Senden hat nicht geklappt. Schreib uns gern direkt an info@mycardfolio.de." });
  }
  res.json({ ok: true });
});

export default router;
