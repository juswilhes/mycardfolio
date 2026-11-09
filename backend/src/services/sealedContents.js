import db from "../db/index.js";

// Inhalt versiegelter Produkte aus der TCGplayer-Beschreibung (Justus 09.11.2026): welche Sets stecken in den
// Boostern (Produkt erscheint dann auf allen diesen Set-Seiten) und welche Promo-Karten liegen dabei.
// Bewusst STRENG - lieber nichts als etwas Falsches:
//  - Set-Namen zählen nur in Sätzen, in denen "booster" vorkommt, und nicht, wenn der Name zugleich eine Serie ist
//    ("Scarlet & Violet", "Sun & Moon", "Mega Evolution", "Platinum" ...: "Mega Evolution—Ascended Heroes" meint
//    nur Ascended Heroes); Namen unter 8 Zeichen ("Dragon") sind zu mehrdeutig; längster Name zuerst, damit
//    "Dragon Majesty" nicht auch als "Dragon" zählt.
//  - Bei Produkten mit eigenem Set kommen weitere Sets nur dazu, wenn EIN Satz mindestens zwei verschiedene nennt
//    ("1 Plasma Storm, Plasma Freeze & Plasma Blast"); eine einzelne Erwähnung ist oft ein Tippfehler.
//  - Promo-Karten: "promo card(s) featuring X, Y or Z" -> Karte gleichen Namens in einem Promo-Set derselben Serie,
//    nur wenn es genau eine solche Karte gibt (Pikachu gibt es dutzendfach: dann bleibt es unbekannt).
// Apostrophe fallen weg ("Team Rocket's Mewtwo" ist nicht das Set "Team Rocket"; "Champion's Path" = "Champions Path")
const norm = (s) =>
  String(s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/['’‘]/g, "").replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").trim();
// Ein-Wort-Set-Namen, die in normalem Text vorkommen ("Mega Evolutions") und deshalb nie als Set zählen
const NOT_A_SET = new Set(["evolutions"]);
const strip = (html) => String(html ?? "").replace(/<br\s*\/?>/gi, "\n").replace(/&nbsp;/g, " ").replace(/<[^>]+>/g, " ");

let ctx = null;
function context() {
  if (ctx) return ctx;
  const sets = db.prepare(`SELECT id, name, series FROM card_sets`).all();
  const seriesNames = new Set(sets.map((s) => norm(s.series)).filter(Boolean));
  const usable = sets
    .map((s) => ({ id: s.id, series: s.series, key: norm(s.name) }))
    .filter((s) => s.key.length >= 8 && !seriesNames.has(s.key) && !NOT_A_SET.has(s.key))
    .sort((a, b) => b.key.length - a.key.length);
  const promoCards = new Map(); // normalisierter Kartenname -> [{ external_id, number, series }]
  const rows = db
    .prepare(
      `SELECT c.external_id, c.name, c.number, s.series FROM cards c JOIN card_sets s ON s.id = c.set_id WHERE s.name LIKE '%Promo%'`
    )
    .all();
  for (const r of rows) {
    const k = norm(r.name);
    if (!promoCards.has(k)) promoCards.set(k, []);
    promoCards.get(k).push(r);
  }
  const seriesOf = new Map(sets.map((s) => [s.id, s.series]));
  ctx = { usable, promoCards, seriesOf };
  return ctx;
}
// Nach einem Import neuer Sets/Karten neu aufbauen lassen
export const resetContentsContext = () => (ctx = null);

// Set-IDs, die in einem Text vorkommen (längster Name zuerst, Treffer werden entfernt)
function setsInText(text) {
  let t = ` ${norm(text)} `;
  const found = [];
  for (const s of context().usable) {
    const k = ` ${s.key} `;
    if (t.includes(k)) {
      found.push(s.id);
      t = t.split(k).join(" ");
    }
  }
  return found;
}

const boosterSentences = (desc) =>
  strip(desc)
    .split(/\n|(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => /booster/i.test(s));

// -> { sets: [setId, ...] (ohne ownSetId), primary: setId|null }
// ownSetId gesetzt: nur Sätze mit >= 2 Sets zählen (siehe oben). Ohne eigenes Set (Sammelgruppen): erstes Set im
// Produktnamen, sonst das erste in den Booster-Sätzen; alle weiteren sind "auch in".
export function setsFor(name, desc, ownSetId = null) {
  const sentences = boosterSentences(desc);
  if (ownSetId) {
    const extra = new Set();
    for (const s of sentences) {
      const ids = setsInText(s);
      if (ids.length >= 2) ids.forEach((id) => id !== ownSetId && extra.add(id));
    }
    return { primary: ownSetId, sets: [...extra] };
  }
  const all = [];
  for (const id of [...setsInText(name), ...sentences.flatMap((s) => setsInText(s))]) if (!all.includes(id)) all.push(id);
  return { primary: all[0] ?? null, sets: all.slice(1) };
}

// "1 foil promo card featuring Mega Emboar ex" -> Karten (external_id) in Promo-Sets der Serie des Produkts
export function promosFor(desc, seriesHint = null) {
  const names = [];
  for (const line of strip(desc).split("\n")) {
    if (!/promo/i.test(line)) continue;
    const m = line.match(/featuring\s+(.+)$/i);
    if (!m) continue;
    // "Mega Emboar ex, oversize lenticular ..." -> beim ersten Gedankenstrich/Punkt/Zusatz abschneiden
    const list = m[1].split(/\s+(?:along with|plus|with)\s+|[.;•]/i)[0];
    for (const part of list.split(/\s*,\s*(?:or\s+|and\s+)?|\s+or\s+|\s+and\s+|\s*&\s*/i)) {
      const number = part.match(/\(([A-Za-z]{0,6}\d+[A-Za-z]?)\)/)?.[1] ?? null;
      const n = part.replace(/\(.*?\)/g, "").replace(/^(?:a |an |the |shiny )/i, "").trim();
      if (n.length >= 3) names.push({ name: n, number });
    }
  }
  const { promoCards } = context();
  const ids = new Set();
  for (const { name, number } of names) {
    let cands = promoCards.get(norm(name)) ?? [];
    if (number) cands = cands.filter((c) => norm(c.number) === norm(number));
    if (seriesHint) cands = cands.filter((c) => !c.series || c.series === seriesHint);
    if (cands.length === 1) ids.add(cands[0].external_id);
  }
  return [...ids];
}

export const seriesOfSet = (setId) => context().seriesOf.get(setId) ?? null;
