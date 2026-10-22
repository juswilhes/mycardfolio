// E-Mail-Versand über SMTP (z. B. IONOS). Ist kein SMTP konfiguriert,
// wird die Mail nur ins Log geschrieben (lokale Entwicklung).
import nodemailer from "nodemailer";
import db from "../db/index.js";
import { mailHtml, esc } from "./mailLayout.js";

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";
const FROM = process.env.MAIL_FROM || process.env.SMTP_USER || "mycardfolio";
export const ADMIN_EMAIL = process.env.ADMIN_EMAIL || process.env.SMTP_USER || null;

let transport = null;
if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
  transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: Number(process.env.SMTP_PORT) === 465, // 465 = direkt TLS, sonst STARTTLS
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  transport.verify().then(
    () => console.log(`[mail] SMTP bereit (${process.env.SMTP_HOST})`),
    (e) => console.error("[mail] SMTP-Verbindung fehlgeschlagen:", e.message)
  );
} else {
  console.log("[mail] Kein SMTP konfiguriert – Mails gehen nur ins Log.");
}

export const mailReady = () => !!transport;

// Ergebnis: true = an den Mailserver übergeben, false = nicht verschickt
async function send({ to, subject, text, html, replyTo }) {
  if (!to) return false;
  if (!transport) {
    console.log(`\n[mail:LOG] an ${to}\nBetreff: ${subject}\n${text || html}\n`);
    return false;
  }
  try {
    await transport.sendMail({ from: FROM, to, subject, text, html, replyTo });
    return true;
  } catch (e) {
    console.error(`[mail] Versand an ${to} fehlgeschlagen:`, e.message);
    return false;
  }
}

export function sendVerificationMail(email, token, { newsletter = false } = {}) {
  const link = `${FRONTEND_URL}/verify?token=${encodeURIComponent(token)}`;
  const doi = newsletter
    ? `Mit dem Klick bestätigst du auch, dass wir dir eine Willkommens-Mail und gelegentlich Neuigkeiten zu mycardfolio ` +
      `per E-Mail schicken dürfen (z. B. neue Funktionen und Aktionen). Abmelden kannst du dich jederzeit mit einem Klick.\n\n`
    : "";
  return send({
    to: email,
    subject: "mycardfolio – E-Mail bestätigen",
    text: `Bestätige deine E-Mail-Adresse:\n${link}\n\n${doi}Der Link ist 24 Stunden gültig. Wenn du dich nicht registriert hast, ignoriere diese Mail.`,
  });
}

export function sendPasswordResetMail(email, token) {
  const link = `${FRONTEND_URL}/passwort-zuruecksetzen?token=${encodeURIComponent(token)}`;
  return send({
    to: email,
    subject: "mycardfolio – Passwort zurücksetzen",
    text: `Setze dein Passwort zurück:\n${link}\n\nDer Link ist 1 Stunde gültig. Wenn du das nicht warst, ignoriere diese Mail.`,
  });
}

export function sendInactivityWarningMail(email, deleteOn) {
  return send({
    to: email,
    subject: "mycardfolio – dein Konto wird gelöscht",
    text:
      `Du hast dein mycardfolio-Konto seit drei Jahren nicht mehr genutzt. Damit keine Daten unnötig gespeichert bleiben, ` +
      `löschen wir es am ${deleteOn} mit deiner Sammlung.\n\n` +
      `Du willst es behalten? Melde dich einfach vorher einmal an:\n${FRONTEND_URL}/login\n\n` +
      `Vorher sichern kannst du deine Daten unter Konto > Daten exportieren.`,
  });
}

// Willkommens-Mail nach der E-Mail-Bestätigung (Aufbau nach Noah Kagan: persönlich, nachprüfbare
// Fakten statt Werbesprech, eine konkrete Frage am Ende - Antworten landen beim Betreiber).
// Inhalt getrennt vom Versand, damit er sich als Vorschau anzeigen lässt
export function buildWelcomeMail(user, unsubscribeLink) {
  const name = user.username?.trim();
  const cards = db.prepare(`SELECT COUNT(*) n FROM cards`).get().n;
  const roughly = (Math.floor(cards / 1000) * 1000).toLocaleString("de-DE");
  const start = `${FRONTEND_URL}/sets`;
  const intro = "danke, dass du mycardfolio ausprobierst! Ich bin Justus, Hobby-Pokémon-Sammler, und baue mycardfolio selbst.";
  // Justus: die Frage soll im Vordergrund stehen - deshalb direkt nach der Begrüßung
  const question = "Bevor du loslegst, eine Frage an dich: Was müsste mycardfolio können, damit es dir wirklich hilft?";
  const answer = "Antworte einfach auf diese Mail – ich lese jede Antwort selbst.";
  const why = "Ich wollte wissen, was meine Karten wert sind, ohne jede einzeln nachzuschlagen. Das kannst du jetzt schon:";
  const can = [
    `über ${roughly} Pokémon-Karten aus allen englischen Sets durchsuchen, mit einem Preis, der jede Nacht neu berechnet wird`,
    "deine Karten eintragen und sehen, was deine Sammlung heute wert ist und wie sich der Wert entwickelt",
    "Karten, die du noch suchst, auf deine Watchlist setzen",
  ];
  const tip = "Mein Tipp für den Start: Trag deine 10 Lieblingskarten ein, das dauert etwa 5 Minuten.";
  const outro = "Ich freue mich riesig, dass du mit am Start bist!";
  const footer = "Du bekommst diese Mail, weil du bei der Registrierung zugestimmt hast.";
  return {
    subject: name ? `Willkommen, ${name} – eine kurze Frage` : "Willkommen bei mycardfolio – eine kurze Frage",
    text:
      `Hallo${name ? ` ${name}` : ""},\n\n${intro}\n\n${question}\n${answer}\n\n${why}\n` +
      can.map((c) => `- ${c}`).join("\n") +
      `\n\n${tip}\n${start}\n\n${outro}\n\nViele Grüße\nJustus\n\n` +
      `--\n${footer} Keine Neuigkeiten mehr: ${unsubscribeLink}`,
    html: mailHtml({
      preheader: "Eine Frage an dich – und ein paar Tipps für den Start.",
      blocks: [
        { p: `Hallo${name ? ` ${esc(name)}` : ""},` },
        { p: esc(intro) },
        { highlight: `${esc(question)}<br><span style="font-weight:normal;font-size:15px">${esc(answer)}</span>` },
        { p: esc(why) },
        { list: can.map(esc) },
        { p: esc(tip) },
        { button: { label: "Erste Karten eintragen", href: start } },
        { p: esc(outro) },
      ],
      signature: "Viele Grüße<br>Justus",
      footer: `${esc(footer)} <a href="${esc(unsubscribeLink)}" style="color:#8a7a63">Keine Neuigkeiten mehr</a>`,
    }),
  };
}

export function sendWelcomeMail(user, unsubscribeLink) {
  return send({ to: user.email, replyTo: ADMIN_EMAIL || undefined, ...buildWelcomeMail(user, unsubscribeLink) });
}

// Feedback aus dem Formular an den Betreiber; Antworten gehen direkt an den Absender (falls bekannt).
export function sendFeedbackMail({ message, email, loggedIn, page }) {
  const from = email ? `${email}${loggedIn ? " (angemeldet)" : " (selbst angegeben)"}` : "anonym";
  return send({
    to: ADMIN_EMAIL,
    subject: "mycardfolio – Feedback",
    text: `Von: ${from}\nSeite: ${page || "-"}\n\n${message}`,
    replyTo: email || undefined,
  });
}

// Interne Mail an den Betreiber (z. B. der Tagesbericht).
export function sendAdminMail(subject, { text, html }) {
  return send({ to: ADMIN_EMAIL, subject, text, html });
}

