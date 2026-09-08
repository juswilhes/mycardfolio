// E-Mail-Versand. Lokal / vor dem Launch nur ein Konsolen-Stub - den
// Link kann man aus dem Backend-Log kopieren. Fuer Produktion hier einen
// echten Anbieter (z. B. SMTP / Resend / Postmark) einsetzen.
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

function log(subject, email, link) {
  console.log(
    `\n[mail] ${subject}\n  an:   ${email}\n  link: ${link}\n`
  );
}

export function sendVerificationMail(email, token) {
  log(
    "E-Mail bestätigen",
    email,
    `${FRONTEND_URL}/verify?token=${encodeURIComponent(token)}`
  );
}

export function sendPasswordResetMail(email, token) {
  log(
    "Passwort zurücksetzen",
    email,
    `${FRONTEND_URL}/passwort-zuruecksetzen?token=${encodeURIComponent(token)}`
  );
}
