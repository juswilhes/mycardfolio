// E-Mail-Versand über SMTP (z. B. IONOS). Ist kein SMTP konfiguriert,
// wird die Mail nur ins Log geschrieben (lokale Entwicklung).
import nodemailer from "nodemailer";

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

async function send({ to, subject, text, html, replyTo }) {
  if (!to) return;
  if (!transport) {
    console.log(`\n[mail:LOG] an ${to}\nBetreff: ${subject}\n${text || html}\n`);
    return;
  }
  try {
    await transport.sendMail({ from: FROM, to, subject, text, html, replyTo });
  } catch (e) {
    console.error(`[mail] Versand an ${to} fehlgeschlagen:`, e.message);
  }
}

export function sendVerificationMail(email, token) {
  const link = `${FRONTEND_URL}/verify?token=${encodeURIComponent(token)}`;
  return send({
    to: email,
    subject: "mycardfolio – E-Mail bestätigen",
    text: `Bestätige deine E-Mail-Adresse:\n${link}\n\nWenn du dich nicht registriert hast, ignoriere diese Mail.`,
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

// Interne Mail an den Betreiber (z. B. der Tagesbericht).
export function sendAdminMail(subject, { text, html }) {
  return send({ to: ADMIN_EMAIL, subject, text, html });
}

// Jemand bietet eine Karte an, die auf der Watchlist eines anderen Nutzers
// steht - Community-Feature: statt nur selbst zu suchen, wird man
// automatisch benachrichtigt, sobald "seine" Karte verfügbar wird.
export function sendWishlistMatchMail(email, { cardName, price, listingUrl }) {
  return send({
    to: email,
    subject: `mycardfolio – ${cardName} ist im Marktplatz aufgetaucht`,
    text: `Eine Karte von deiner Watchlist wird gerade im Marktplatz angeboten:\n\n${cardName} – ${price}\n\n${listingUrl}\n\nDu bekommst diese Mail, weil "${cardName}" auf deiner Watchlist steht.`,
  });
}

// Kaufinteresse: Nachricht eines Käufers an den Verkäufer. Reply-To ist die
// Adresse des Käufers, damit beide direkt per Mail weiterschreiben können
// (Zahlung und Versand regeln sie ohne mycardfolio selbst).
export function sendListingContactMail(email, { listingTitle, listingUrl, message, buyerName, buyerEmail }) {
  return send({
    to: email,
    replyTo: buyerEmail,
    subject: `mycardfolio – Interesse an "${listingTitle}"`,
    text: `${buyerName || buyerEmail} interessiert sich für dein Angebot "${listingTitle}":\n\n${message}\n\nAntworten kannst du direkt auf diese Mail (Antwort geht an ${buyerEmail}).\nAngebot: ${listingUrl}\n\nWenn ihr euch einig seid: Markiere das Angebot bei mycardfolio als verkauft, dann könnt ihr euch gegenseitig bewerten.`,
  });
}

// Neue Frage/Kommentar zu einem eigenen Angebot.
export function sendListingCommentMail(email, { listingTitle, listingUrl, authorName }) {
  return send({
    to: email,
    subject: `mycardfolio – Neue Frage zu deinem Angebot "${listingTitle}"`,
    text: `${authorName || "Jemand"} hat eine Frage zu deinem Angebot "${listingTitle}" gestellt:\n\n${listingUrl}`,
  });
}
