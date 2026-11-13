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

// "1 foil promo card featuring Mega Emboar ex" -> je Zeile { count, ids }: wie viele Promo-Karten die Zeile nennt
// ("1 ... featuring A or B" = eine von zwei) und welche Karten (external_id) in Promo-Sets der Serie dazu passen.
// Aufzählungszeilen zuerst: sie tragen die Stückzahl, der Fließtext wiederholt dieselben Karten nur.
function promoGroups(desc, seriesHint = null) {
  const { promoCards } = context();
  const lines = strip(desc).split("\n").filter((l) => /promo/i.test(l));
  const isBullet = (l) => /^\s*[•*-]/.test(l);
  const groups = [];
  for (const line of [...lines.filter(isBullet), ...lines.filter((l) => !isBullet(l))]) {
    const m = line.match(/featuring\s+(.+)$/i);
    if (!m) continue;
    // "Mega Emboar ex, oversize lenticular ..." -> beim ersten Gedankenstrich/Punkt/Zusatz abschneiden
    const list = m[1].split(/\s+(?:along with|plus|with)\s+|[.;•]/i)[0];
    const ids = [];
    for (const part of list.split(/\s*,\s*(?:or\s+|and\s+)?|\s+or\s+|\s+and\s+|\s*&\s*/i)) {
      const number = part.match(/\(([A-Za-z]{0,6}\d+[A-Za-z]?)\)/)?.[1] ?? null;
      const n = part.replace(/\(.*?\)/g, "").replace(/^(?:a |an |the |shiny )/i, "").trim();
      if (n.length < 3) continue;
      let cands = promoCards.get(norm(n)) ?? [];
      if (number) cands = cands.filter((c) => norm(c.number) === norm(number));
      if (seriesHint) cands = cands.filter((c) => !c.series || c.series === seriesHint);
      if (cands.length === 1 && !ids.includes(cands[0].external_id)) ids.push(cands[0].external_id);
    }
    const lead = line.match(/^\s*[•*-]?\s*(\d{1,2}|one|two|three|four|five|six)\b/i);
    if (ids.length) groups.push({ count: lead ? toNum(lead[1]) : 1, ids });
  }
  return groups;
}

export const promosFor = (desc, seriesHint = null) => [...new Set(promoGroups(desc, seriesHint).flatMap((g) => g.ids))];

// Wert der beiliegenden Promo-Karten (priceOf: external_id -> aktueller Preis oder 0), VORSICHTIG gerechnet:
// je Zeile höchstens so viele Karten, wie sie nennt, und zwar die günstigsten ("A or B" = die billigere);
// jede Karte zählt nur einmal. Lieber zu wenig abziehen als ein Produkt schönrechnen.
export function promoValue(desc, seriesHint, priceOf) {
  const seen = new Set();
  let total = 0;
  for (const g of promoGroups(desc, seriesHint)) {
    const fresh = g.ids.filter((id) => !seen.has(id));
    fresh.forEach((id) => seen.add(id));
    const prices = fresh.map(priceOf).filter((p) => p > 0).sort((x, y) => x - y);
    for (const p of prices.slice(0, g.count)) total += p;
  }
  return total;
}

export const seriesOfSet = (setId) => context().seriesOf.get(setId) ?? null;

// --- Anzahl der Booster in einem Produkt (Analyse "Preis pro Booster", Justus 13.11.2026) ------------------
// Aus der Beschreibung ("• 9 Pokémon TCG: ... booster packs", "Each tin contains ... four booster packs"), sonst
// aus dem Produktnamen (Booster Box = 36, Booster Bundle = 6 ...). STRENG: Sammelpackungen (Display mehrerer
// Produkte, Case, "Set of N", Händler-Bündel) bekommen keine Zahl - dort nennt die Beschreibung den Inhalt EINES
// Teils und der Preis pro Booster wäre falsch. Unbekannt = null (das Produkt fehlt dann in der Analyse).
const NUM_WORD = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
  thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, eighteen: 18, twenty: 20, "thirty-six": 36,
};
const NUM_RE = /\b(\d{1,3}|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|eighteen|twenty|thirty-six)\b/i;
const toNum = (t) => NUM_WORD[t.toLowerCase()] ?? Number(t);
// Mehrere Produkte in einem (Preis gilt für alle zusammen, die Beschreibung aber für eins)
const MULTI_UNIT = /\bcase\b|\bdisplay\b|\+|\b\d+[- ]pack\b(?![- ]?(?:booster )?blister)|\bcostco\b|sam'?s club|\bstadium\b/i;

// Summe der Booster in EINEM Satz: je Teilsatz ("three X booster packs, and one Y booster pack") die erste Zahl
// vor "booster pack". "151" ist ein Set-Name, keine Anzahl.
function boostersInSentence(sentence) {
  let sum = 0;
  for (const clause of sentence.replace(/\b151\b/g, " ").split(/[,;(•]|\band\b|\bplus\b/i)) {
    const at = clause.search(/\bbooster\s+packs?\b/i);
    if (at < 0) continue;
    const m = clause.slice(0, at).match(NUM_RE);
    if (m) sum += toNum(m[1]);
  }
  return sum;
}

export function boosterCount(name, desc) {
  const n = String(name ?? "");
  const core = n.replace(/\s*[[(].*$/, "").trim(); // ohne Zusätze in Klammern
  if (MULTI_UNIT.test(n)) return null;
  // "Bundle" nur als Booster Bundle (6 Booster) oder Art Bundle (Set of 4), nicht als Händler-Bündel
  if (/\bbundle\b/i.test(n) && !/\b(booster|art) bundle$/i.test(core)) return null;
  const setOf = n.match(/\bset of (\d+)\b/i);
  // Einzelne Booster (auch als "Set of 4" verschiedener Motive)
  if (/\bbooster pack\b/i.test(n) && !/blister/i.test(n)) return setOf ? Number(setOf[1]) : 1;
  if (setOf) return null;

  const bullets = [];
  const prose = [];
  for (const line of strip(desc).split("\n")) {
    const isBullet = /^\s*[•*-]/.test(line);
    for (const sentence of line.split(/(?<=[.!?])\s+/)) {
      const c = boostersInSentence(sentence);
      if (c > 0) (isBullet ? bullets : prose).push(c);
    }
  }
  // Aufzählung vorhanden: ihre Zeilen addieren; sonst wiederholt der Fließtext dieselbe Zahl -> die größte
  let count = bullets.length ? bullets.reduce((a, b) => a + b, 0) : prose.length ? Math.max(...prose) : null;

  // Feste Größen aus dem Namen, wenn die Beschreibung nichts hergibt
  if (count == null) {
    const blister = n.match(/\b(\d+)[- ]pack\b[- ]?(?:booster )?blister/i);
    if (/\bhalf booster box\b/i.test(n)) count = 18;
    else if (/\bbooster box\b/i.test(n) && !/enhanced/i.test(n)) count = 36;
    else if (/\bbooster bundle\b/i.test(n)) count = 6;
    else if (blister) count = Number(blister[1]);
    else if (/\b(single pack|checklane) blister\b/i.test(n)) count = 1;
  }
  return count && count > 0 && count <= 60 ? count : null;
}
