// ============================================================================
//  BITTE AUSFÜLLEN vor dem Livegang.
//  Impressum & Datenschutzerklärung lesen diese Werte. Ein Impressum mit
//  unvollständiger/falscher Anschrift ist abmahnfähig – die Adresse muss
//  ladungsfähig sein (kein Postfach). Vor Veröffentlichung von einer
//  fachkundigen Person (Anwalt / eRecht24 o. Ä.) prüfen lassen.
// ============================================================================

export const OPERATOR = {
  // Vollständiger Name der natürlichen Person, die die Seite betreibt
  name: "Justus Heß",
  // Ladungsfähige Anschrift
  street: "Alsenstraße 18",
  postalCode: "42781",
  city: "Haan",
  country: "Deutschland",
  // Kontakt – am besten eine eigene Adresse auf der Domain, kein privates Postfach
  email: "info@mycardfolio.de",
  phone: "", // optional, z. B. "+49 ..." – leer lassen wenn nicht gewünscht
  // Umsatzsteuer-ID, falls vorhanden (bei Kleinunternehmer §19 UStG meist nicht)
  vatId: "",
};

// Wo die Anwendung läuft. Diese Angaben gehören in die
// Datenschutzerklärung (Server-Logs / Auftragsverarbeitung).
export const HOSTING = {
  provider: "IONOS SE",
  address: "Elgendorfer Straße 57, 56410 Montabaur",
  // Serverstandort (für Drittlandübermittlung relevant)
  serverLocation: "Deutschland",
};

export const SITE = {
  domain: "mycardfolio.de",
  altDomain: "mycardfolio.eu",
  lastUpdated: "2026-09-08", // Datum der letzten Änderung dieser Texte
};

// Fertig ausgefüllt? Dann hier auf true setzen – blendet den Hinweisbanner
// auf den Rechtstexten aus.
export const LEGAL_REVIEWED = true;
