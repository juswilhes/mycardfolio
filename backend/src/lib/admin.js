// Wer ist der Betreiber – um dessen eigene Aktivität aus dem Bericht
// herauszufiltern.
//   ADMIN_EMAIL     – Empfänger des Tagesberichts
//   OPERATOR_EMAIL  – das Konto, mit dem DU dich auf der Seite anmeldest
//                     (Standard = ADMIN_EMAIL). Dessen Aktivität wird
//                     herausgerechnet.
//   ADMIN_IPS       – optional, eigene IP-Adressen (kommagetrennt) für
//                     Zugriffe ohne Login.
export const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();

export const OPERATOR_EMAIL = (
  process.env.OPERATOR_EMAIL ||
  process.env.ADMIN_EMAIL ||
  ""
)
  .trim()
  .toLowerCase();

export const ADMIN_IPS = new Set(
  (process.env.ADMIN_IPS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
);

// Ist dieser Nutzer der Betreiber? Für Dinge, die nur du ändern darfst
// (Illustrator-Korrektur, Booster-Box-Preise, Pull-Rates, ...) - normale
// Nutzer sollen Kartenstammdaten nicht anonym verändern können.
export const isOperatorUser = (user) =>
  !!OPERATOR_EMAIL && !!user && String(user.email).toLowerCase() === OPERATOR_EMAIL;
