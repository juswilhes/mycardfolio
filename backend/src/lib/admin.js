// Identifikation des Betreibers, um dessen eigene Aktivität aus dem
// Tagesbericht herauszufiltern.
//   ADMIN_EMAIL  – das Konto des Betreibers (ist auch Empfänger des Berichts)
//   ADMIN_IPS    – optional, kommagetrennte eigene IP-Adressen (für Zugriffe
//                  ohne Login, z. B. wenn nur die Startseite aufgerufen wird)
export const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();

export const ADMIN_IPS = new Set(
  (process.env.ADMIN_IPS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
);
