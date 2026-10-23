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
      `\n\n${tip}\n${start}\n\n${outro}\n\nLiebe Grüße\nJustus\n\n` +
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
      signature: "Liebe Grüße<br>Justus",
      footer: `${esc(footer)} <a href="${esc(unsubscribeLink)}" style="color:#8a7a63">Keine Neuigkeiten mehr</a>`,
    }),
  };
}

// --- Folge-Mails nach Noah Kagan (Tag 3: Verbindung, Tag 7: Inhalt) --------------------------
// Nur an Nutzer mit bestätigter E-Mail-Einwilligung, immer mit Abmeldelink. Texte als Entwurf,
// noch NICHT automatisch verschickt (Justus gibt sie erst frei).
const consentFooter = (unsubscribeLink) => ({
  text: `--\nDu bekommst diese Mail, weil du Neuigkeiten von mycardfolio zugestimmt hast. Keine Neuigkeiten mehr: ${unsubscribeLink}`,
  html: `Du bekommst diese Mail, weil du Neuigkeiten von mycardfolio zugestimmt hast. <a href="${esc(unsubscribeLink)}" style="color:#8a7a63">Keine Neuigkeiten mehr</a>`,
});

// Justus' eigene Geschichte - bis er sie nennt, steht hier ein sichtbarer Platzhalter
const FAVORITE_CARD = "[deine Lieblingskarte und die Geschichte dazu]";

export function buildConnectionMail(user, unsubscribeLink) {
  const name = user.username?.trim();
  const hello = `Hallo${name ? ` ${name}` : ""},`;
  const q = "Welche Karte ist deine liebste, und warum?";
  const lead = "eine Frage, die nichts mit Preisen zu tun hat:";
  const mine = `Meine ist ${FAVORITE_CARD}.`;
  const ask = "Antworte einfach mit einem Foto oder ein paar Sätzen – ich lese jede Nachricht selbst und antworte dir.";
  const f = consentFooter(unsubscribeLink);
  return {
    subject: "Zeig mir deine Lieblingskarte",
    text: `${hello}\n\n${lead} ${q}\n\n${mine}\n\n${ask}\n\nLiebe Grüße\nJustus\n\n${f.text}`,
    html: mailHtml({
      preheader: "Eine Frage, die nichts mit Preisen zu tun hat.",
      blocks: [{ p: esc(hello) }, { p: esc(lead) }, { highlight: esc(q) }, { p: esc(mine) }, { p: esc(ask) }],
      signature: "Liebe Grüße<br>Justus",
      footer: f.html,
    }),
  };
}

export function buildContentMail(user, unsubscribeLink) {
  const name = user.username?.trim();
  const hello = `Hallo${name ? ` ${name}` : ""},`;
  const story =
    "als ich mycardfolio gebaut habe, ist mir etwas aufgefallen: Bei Drowzee aus Scarlet & Violet (Nr. 210) sprang der " +
    "Cardmarket-Trend innerhalb kurzer Zeit von 37 auf 80 Euro. Der Durchschnitt der letzten 30 Tage lag die ganze Zeit ruhig " +
    "bei 47 Euro. Wer an dem Tag nach dem Trend gekauft oder verkauft hätte, hätte ziemlich danebengelegen.";
  const why = "Der Grund: Bei Karten mit wenigen Verkäufen reicht ein einziger Ausreißer, um den Trend zu verschieben.";
  const how =
    "Deshalb nimmt mycardfolio nicht einen einzelnen Wert, sondern den Mittelwert aus mehreren (Trend und Durchschnitt über " +
    "1, 7 und 30 Tage) und glättet einzelne Sprünge. Bei teuren Karten vergleichen wir zusätzlich mit dem US-Markt.";
  const more = "Wie du den Wert deiner Karten selbst richtig einschätzt – Zustand, Version und Preisquelle – habe ich hier aufgeschrieben:";
  const link = `${FRONTEND_URL}/news/wie-finde-ich-heraus-was-meine-pokemon-karte-wert-ist`;
  const f = consentFooter(unsubscribeLink);
  return {
    subject: "Warum der Preis auf Cardmarket manchmal lügt",
    text: `${hello}\n\n${story}\n\n${why}\n\n${how}\n\n${more}\n${link}\n\nLiebe Grüße\nJustus\n\n${f.text}`,
    html: mailHtml({
      preheader: "Drowzee: von 37 auf 80 Euro – und trotzdem nur 47 wert.",
      blocks: [
        { p: esc(hello) },
        { p: esc(story) },
        { highlight: esc(why) },
        { p: esc(how) },
        { p: esc(more) },
        { button: { label: "Zum Ratgeber", href: link } },
      ],
      signature: "Liebe Grüße<br>Justus",
      footer: f.html,
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

