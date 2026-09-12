// Lesezugriffe auf die lokal importierten Karten-/Set-Stammdaten.
// Ersetzt für Suche, Set-Listen und Kartendetails die Live-API-Aufrufe.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import db from "../db/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Deutsch -> Englisch für Pokémon-Namen, damit die Suche auch mit "Glurak"
// oder "Relaxo" funktioniert (der Datensatz ist englisch).
let DE_EN = {};
try {
  DE_EN = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data", "pokemon-de-en.json"), "utf8"));
} catch {
  /* Liste optional - Suche fällt dann auf reines Englisch zurück */
}

const parse = (v) => {
  if (v == null) return null;
  try { return JSON.parse(v); } catch { return null; }
};

// Wandelt eine cards-Zeile in das Format um, das das Frontend erwartet -
// inkl. aller Zusatzinfos (Artist, Attacken, Schwächen, ...).
export function rowToCard(row) {
  if (!row) return null;
  return {
    external_id: row.external_id,
    name: row.name,
    set_name: row.set_name,
    set_id: row.set_id,
    number: row.number,
    rarity: row.rarity,
    image_small: row.image_small,
    image_large: row.image_large,
    supertype: row.supertype,
    subtypes: parse(row.subtypes) ?? [],
    types: parse(row.types) ?? [],
    hp: row.hp,
    artist: row.artist,
    flavor_text: row.flavor_text,
    national_pokedex: parse(row.national_pokedex) ?? [],
    evolves_from: row.evolves_from,
    abilities: parse(row.abilities) ?? [],
    attacks: parse(row.attacks) ?? [],
    weaknesses: parse(row.weaknesses) ?? [],
    resistances: parse(row.resistances) ?? [],
    retreat_cost: parse(row.retreat_cost) ?? [],
    rules: parse(row.rules) ?? [],
    legalities: parse(row.legalities) ?? {},
    regulation_mark: row.regulation_mark,
    artist_source: row.artist_source,
    artist_manual: !!row.artist_manual,
    set_release_date: row.set_release_date ?? null,
    year: row.set_release_date ? String(row.set_release_date).slice(0, 4) : null,
    set_logo: row.set_logo ?? null,
    view_count: row.view_count ?? 0,
  };
}

// Zählt einen Aufruf der Karten-Detailseite - Basis für "Beliebtheit" in
// der Set-Übersicht. Bewusst hier (im HTTP-Handler-Pfad) und nicht in
// tieferen Preis-Funktionen, damit interne Cron-Abrufe (priceFetcher)
// nicht mitzählen, nur echte Seitenaufrufe.
const bumpViewStmt = db.prepare(
  `UPDATE cards SET view_count = COALESCE(view_count, 0) + 1 WHERE external_id = ?`
);
export const bumpCardView = (externalId) => {
  try {
    bumpViewStmt.run(externalId);
  } catch {
    /* Zählung darf nie einen Request stören */
  }
};

// Query um deutsche Namenstreffer erweitern:
//  - "Glurak"  -> auch "Charizard"
//  - "Glur"    -> auch "Charizard" (deutscher Name beginnt mit der Eingabe)
//  - "Glurak ex" -> auch "Charizard" (Eingabe beginnt mit deutschem Namen)
function expandQuery(query) {
  const q = query.trim();
  const ql = q.toLowerCase();
  const terms = new Set([q]);
  if (ql.length >= 2) {
    for (const [de, en] of Object.entries(DE_EN)) {
      if (de === ql || de.startsWith(ql) || ql.startsWith(de + " ") || ql.startsWith(de)) {
        terms.add(en);
      }
    }
  }
  return [...terms].slice(0, 12);
}

// Kartennummer/Kürzel für den Vergleich normalisieren: GROSS, ohne Leer-/
// Sonderzeichen, ohne führende Nullen im Zahlteil.
//  "SWSH 150" / "swsh150" -> "SWSH150"   "SWSH072" -> "SWSH72"   "TG02" -> "TG2"
const normNum = (n) =>
  String(n ?? "")
    .trim()
    .toUpperCase()
    .replace(/[\s.\-]/g, "")
    .replace(/^([A-Z]*?)0*(\d)/, "$1$2");

// Promo-/Teilset-Kürzel, die in der DB direkt an der Nummer kleben
// ("SWSH150", "SM172", "TG02", "GG50"). Nutzer tippen sie oft mit
// Leerzeichen ("Vaporeon V SWSH 150") - dann landet das Kürzel im Namensteil.
const PROMO_PREFIX =
  /^(SWSH|SM|SV|SVP|SMP|XY|XYP|BW|BWP|HGSS|DP|DPP|RC|TG|GG)$/i;

// Set-Kürzel/-Namen -> Set-IDs. Damit findet die Suche auch "... MEP 32"
// (Set-ID) oder "... 151 199" (einwortiger Set-Name). Der Token wird beim
// Suchen vom Namensteil abgetrennt und als Set-Filter genutzt.
const setTokenMap = new Map();
const tokKey = (s) => String(s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
function addSetToken(tok, id) {
  const k = tokKey(tok);
  if (k.length < 2) return;
  if (!setTokenMap.has(k)) setTokenMap.set(k, new Set());
  setTokenMap.get(k).add(id);
}
try {
  for (const s of db
    .prepare(`SELECT id, name FROM card_sets WHERE game_id = (SELECT id FROM games WHERE slug = 'pokemon')`)
    .all()) {
    addSetToken(s.id, s.id);
    const parts = String(s.name ?? "").trim().split(/\s+/);
    if (parts.length === 1) addSetToken(parts[0], s.id); // einwortige Set-Namen ("151", "Evolutions")
  }
} catch {
  /* card_sets evtl. noch leer - Suche läuft dann ohne Set-Token */
}
const setIdsForToken = (tok) => setTokenMap.get(tokKey(tok)) ?? null;

// Trennt eine evtl. angehängte Kartennummer ab. Die "eigene" Nummer der
// Karte steht vor dem "/", der Teil danach ist die Set-Gesamtzahl.
//  "Mega Absol ex 180/132"      -> { text: "Mega Absol ex",   number: "180" }
//  "Darkrai VSTAR GG50/GG70"     -> { text: "Darkrai VSTAR",   number: "GG50" }
//  "Rayquaza TG05"               -> { text: "Rayquaza",        number: "TG05" }
//  "Vaporeon V SWSH 150"         -> { text: "Vaporeon V",      number: "SWSH150" }
//  "180/132" / "180"             -> { text: "",                number: "180" }
const NUM = "[A-Za-z]{0,4}\\d+[A-Za-z]?";
function splitNumber(query) {
  // Nummer nur abtrennen, wenn sie ein eigenes Wort ist (Leerzeichen/# davor)
  // oder die ganze Eingabe ist - sonst würde "Porygon2" zerlegt.
  const m = query.trim().match(new RegExp(`^(?:(.*?)[\\s#]+)?(${NUM})(?:\\s*/\\s*${NUM})?\\s*$`));
  if (!m || !m[2]) return { text: query.trim(), number: null };

  let text = (m[1] ?? "").trim();
  let number = m[2];

  // "... SWSH 150": das Promo-Kürzel steht als letztes Wort im Namensteil,
  // die Nummer sind nur Ziffern -> beides zur echten Kartennummer zusammenziehen.
  if (/^\d+[A-Za-z]?$/.test(number) && text) {
    const parts = text.split(/\s+/);
    if (PROMO_PREFIX.test(parts[parts.length - 1])) {
      number = parts.pop().toUpperCase() + number;
      text = parts.join(" ");
    }
  }
  return { text, number };
}

// Apostrophe raus - Karten wie "N's Zekrom" oder "Farfetch'd" tippen die
// meisten ohne Apostroph ("Ns Zekrom", "Farfetchd"). Ohne Normalisierung
// verhindert das ' im Namen jeden LIKE-Treffer.
const stripApos = (s) => String(s ?? "").replace(/['’‘]/g, "");
const NAME_COL = "REPLACE(REPLACE(c.name, '''', ''), '’', '')";

// EIN fest vorbereitetes Statement mit fixer Parameterzahl (statt bei jeder
// Suche ein neues zu prepare()n - das hat better-sqlite3 unter der schnellen
// Tipp-Suche zum Absturz gebracht). Ungenutzte Slots bekommen NULL.
const MAX_TERMS = 8;
const likeSlots = Array.from({ length: MAX_TERMS }, (_, i) => `${NAME_COL} LIKE @like${i} COLLATE NOCASE`).join(" OR ");
const preSlots = Array.from({ length: MAX_TERMS }, (_, i) => `${NAME_COL} LIKE @pre${i} COLLATE NOCASE`).join(" OR ");

const searchStmt = db.prepare(`
  SELECT c.* FROM cards c
  LEFT JOIN card_sets s ON s.id = c.set_id
  WHERE c.game_id = (SELECT id FROM games WHERE slug = @game)
    AND (@hasName = 0 OR (${likeSlots}))
    AND (@num IS NULL OR c.number = @num COLLATE NOCASE)
  ORDER BY
    CASE WHEN @hasName = 1 AND (${preSlots}) THEN 0 ELSE 1 END,
    LENGTH(c.name), s.release_date DESC, c.name
  LIMIT @limit
`);

function runSearch({ game, terms, number, limit }) {
  const t = terms.slice(0, MAX_TERMS);
  const params = { game, num: number || null, limit, hasName: t.length ? 1 : 0 };
  for (let i = 0; i < MAX_TERMS; i++) {
    const term = i < t.length ? stripApos(t[i]) : null;
    params[`like${i}`] = term != null ? `%${term}%` : null;
    params[`pre${i}`] = term != null ? `${term}%` : null;
  }
  return searchStmt.all(params).map(rowToCard);
}

export function searchCardsLocal(query, { game = "pokemon", limit = 30 } = {}) {
  let { text, number } = splitNumber(query);

  // Set-Kürzel/-Name am Ende des Namensteils abtrennen ("Mega Gardevoir ex MEP 32").
  let setIds = null;
  const w = text.split(/\s+/).filter(Boolean);
  if (w.length > 1) {
    const ids = setIdsForToken(w[w.length - 1]);
    if (ids) {
      setIds = ids;
      text = w.slice(0, -1).join(" ");
    }
  }

  const terms = text ? expandQuery(text) : [];
  const want = number ? normNum(number) : null;

  let rows = runSearch({ game, terms, number, limit });

  // Nachfiltern, wenn die exakte Runde nichts brachte ODER ein Set-Token
  // gesetzt ist: breit über den Namen suchen und in JS nach normalisierter
  // Nummer / Set filtern (Nummernschema variiert je Sprache/Promo/führende Null;
  // "SWSH 150" == "SWSH150", "MEP 32" == Set mep + Nr. 032).
  if ((rows.length === 0 || setIds) && terms.length) {
    const wide = runSearch({ game, terms, number: null, limit: Math.max(limit, 80) });
    let pool = wide;
    if (setIds) pool = pool.filter((r) => r.set_id && setIds.has(r.set_id));
    if (want) {
      const hit = pool.filter((r) => normNum(r.number) === want);
      if (hit.length) pool = hit;
    }
    if (pool.length) rows = pool.slice(0, limit);
    else if (rows.length === 0) rows = wide.slice(0, limit);
  }

  // Letzter Versuch bei Null Treffern: Tippfehler im Namen abfangen
  // ("Pikuchu", "mGuardevour ex" statt "Mega Gardevoir ex"/"M Gardevoir-EX").
  if (rows.length === 0 && text) {
    let fuzzy = fuzzyNameSearch(text, game, Math.max(limit, 80));
    if (setIds) fuzzy = fuzzy.filter((r) => r.set_id && setIds.has(r.set_id));
    if (want) {
      const hit = fuzzy.filter((r) => normNum(r.number) === want);
      if (hit.length) fuzzy = hit;
    }
    rows = fuzzy.slice(0, limit);
  }
  return rows;
}

const normLoose = (s) => (s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");

// --- Tippfehler-Toleranz für die Namenssuche ---------------------------
// Nur als letzter Fallback (siehe oben) - vergleicht den ganzen
// normalisierten Suchtext gegen alle bekannten Kartennamen per
// Levenshtein-Distanz. Absichtlich strikt: lieber "nichts gefunden" als
// bei einem kurzen, mehrdeutigen Wort eine zufällige falsche Karte raten.
let nameVocabCache = null;
function nameVocab(game) {
  if (!nameVocabCache) nameVocabCache = new Map();
  if (!nameVocabCache.has(game)) {
    const rows = db
      .prepare(`SELECT DISTINCT c.name FROM cards c WHERE c.game_id = (SELECT id FROM games WHERE slug = ?)`)
      .all(game);
    nameVocabCache.set(game, rows.map((r) => ({ name: r.name, norm: normLoose(r.name) })));
  }
  return nameVocabCache.get(game);
}

function levenshtein(a, b) {
  const m = a.length, n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  let curr = new Array(n + 1);
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

// Länger erlaubt mehr Abweichung, aber nie beliebig viel - sonst würde
// z.B. ein kurzes Wort quasi jeden ähnlich kurzen Namen "treffen".
function fuzzyThreshold(len) {
  if (len <= 6) return 1;
  if (len <= 10) return 2;
  if (len <= 16) return 3;
  return 4;
}

function fuzzyNameSearch(text, game, limit) {
  const nq = normLoose(text);
  if (nq.length < 4) return [];
  const th = fuzzyThreshold(nq.length);
  const scored = [];
  for (const { name, norm } of nameVocab(game)) {
    if (Math.abs(norm.length - nq.length) > th) continue;
    const d = levenshtein(nq, norm);
    if (d <= th) scored.push({ name, d });
  }
  if (!scored.length) return [];
  scored.sort((a, b) => a.d - b.d);
  const names = [...new Set(scored.map((s) => s.name))].slice(0, 5);
  const rank = new Map(names.map((n, i) => [n, i]));
  const placeholders = names.map(() => "?").join(",");
  const rows = db
    .prepare(
      `SELECT c.* FROM cards c
       WHERE c.game_id = (SELECT id FROM games WHERE slug = ?) AND c.name IN (${placeholders})`
    )
    .all(game, ...names)
    .map(rowToCard);
  // Reihenfolge nach Tippfehler-Nähe (kleinste Distanz zuerst) statt
  // alphabetisch/nach Namenslänge - sonst verdrängen z.B. viele "Pichu"-
  // Drucke (kürzerer, aber weiter entfernter Name) das eigentlich näher
  // passende "Pikachu".
  rows.sort((a, b) => rank.get(a.name) - rank.get(b.name));
  return rows.slice(0, limit);
}

const words = (s) => (s ?? "").toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length >= 2);
// Wort-Überlappung zweier Set-Namen (0..1). "Obsidian Flames" vs
// "Obsidian Flames" = 1; "151" vs "Pokemon 151" > 0; unpassend = 0.
function setSimilarity(a, b) {
  const wa = new Set(words(a));
  const wb = words(b);
  if (!wa.size || !wb.length) return 0;
  const hit = wb.filter((w) => wa.has(w)).length;
  return hit / Math.max(wa.size, wb.length);
}

// Deutschen Kartennamen fürs Scoring übersetzen ("Glurak ex" -> "Charizardex").
// Unser Datensatz ist englisch, Import-Listen oft deutsch. Ohne das bleibt
// der Namens-Bonus unten bei jeder deutschen Eingabe 0 (z.B. "glurakex"
// passt nie zu "charizardex"), obwohl die Suche (die DE_EN bereits über
// expandQuery nutzt) die richtige Karte längst gefunden hat - der Import
// wählt dann faktisch zufällig zwischen den Treffern.
function translateGermanName(name) {
  const q = (name ?? "").trim();
  const ql = q.toLowerCase();
  let best = null;
  for (const de of Object.keys(DE_EN)) {
    if ((ql === de || ql.startsWith(de + " ")) && (!best || de.length > best.length)) {
      best = de;
    }
  }
  return best ? DE_EN[best] + q.slice(best.length) : null;
}

// Sonderzeichen, die in diesem Datensatz eine ECHTE andere Karte markieren
// (δ = Delta Species, ★/◇ = Shining/Crystal, α/β/γ = weitere Sonderformen) -
// normLoose entfernt sie wie jedes Satzzeichen, würde "Charizard" und
// "Charizard δ" damit fälschlich als exakt gleich werten.
const MARKER_RE = /[δ★◇αβγ]/g;
const markers = (s) => (s.match(MARKER_RE) || []).sort().join("");

// Bester Namens-Treffer über ggf. mehrere Zielformen (Original + Übersetzung).
// targets: [{ loose, raw }]
function bestNameMatch(rRaw, rn, targets) {
  const rMarkers = markers(rRaw);
  let best = { score: 0, target: targets[0]?.loose ?? "" };
  for (const t of targets) {
    let score = 0;
    if (rn === t.loose) {
      // Nur ein wirklich exakter Treffer, wenn auch die Sonderzeichen passen -
      // sonst (z.B. "Charizard" vs. "Charizard δ") nur ein Teiltreffer, klar
      // unter dem echten exakten Treffer, aber über einem reinen Präfix-Treffer.
      score = rMarkers === markers(t.raw) ? 30 : 14;
    } else if (rn.startsWith(t.loose) || t.loose.startsWith(rn)) score = 12;
    else if (rn.includes(t.loose)) score = 4;
    if (score > best.score) best = { score, target: t.loose };
  }
  return best;
}

// Beste Übereinstimmung für eine Zeile aus einem Massen-Import.
// name kann die Nummer bereits enthalten; number/set schränken zusätzlich ein.
export function matchCardForImport({ name, number, set }) {
  if (!name || !name.trim()) return { best: null, candidates: [] };

  // Steckt die Nummer noch im Namen ("Glutexo 28/108" statt einer eigenen
  // Spalte - z.B. bei Cardmarket-Exporten sehr üblich), rausziehen: sonst
  // greift unten der +100-Nummern-Bonus nie, und JEDE Zeile bekommt
  // "Prüfungsbedarf", weil der Namens-Score allein nie hoch genug ist.
  let effName = name;
  let effNumber = number;
  if (!effNumber) {
    const split = splitNumber(name);
    if (split.number && split.text) {
      effName = split.text;
      effNumber = split.number;
    }
  }

  let rows = searchCardsLocal(effNumber ? `${effName} ${effNumber}` : effName, { limit: 60 });
  if (!rows.length) rows = searchCardsLocal(effName, { limit: 60 });
  if (!rows.length) return { best: null, candidates: [] };

  const nn = effNumber ? normNum(effNumber) : null;
  const nName = normLoose(effName);
  const translated = translateGermanName(effName);
  const nNameEn = normLoose(translated ?? "");
  const nameTargets =
    nNameEn && nNameEn !== nName
      ? [
          { loose: nName, raw: effName },
          { loose: nNameEn, raw: translated },
        ]
      : [{ loose: nName, raw: effName }];

  // jede Karte bewerten: Nummer > Set > exakter Name > Namensanfang
  const scored = rows.map((r) => {
    let score = 0;
    if (nn && normNum(r.number) === nn) score += 100;
    if (set) {
      const sim = setSimilarity(set, r.set_name);
      if (sim >= 0.5) score += 40;
      else if (sim > 0) score += 15;
      else score -= 10;
    }
    const rn = normLoose(r.name);
    const { score: nameScore, target } = bestNameMatch(r.name, rn, nameTargets);
    score += nameScore;
    score -= Math.min(10, Math.abs(rn.length - target.length) / 3); // kürzere Namen bevorzugen
    return { r, score, rn, nameScore };
  });
  scored.sort((a, b) => b.score - a.score);

  const best = scored[0]?.r ?? null;
  // Niedrige Konfidenz = bester Treffer und der nächste ANDERS BENANNTE
  // Treffer liegen fast gleichauf, oder der Treffer insgesamt ist schwach.
  // Bewusst nur gegen den EXAKTEN Kartennamen vergleichen (nicht normalisiert):
  // dieselbe Karte in mehreren Sets/Auflagen (z.B. "Charizard" 15x
  // nachgedruckt) ist keine echte Verwechslungsgefahr - sonst stünde bei
  // praktisch jeder verbreiteten Karte "Prüfungsbedarf". Sonderzeichen wie
  // "δ"/"★" markieren dagegen eine ECHTE andere Karte (z.B. Delta-Species-
  // Variante) und müssen als unterschiedlich zählen - normLoose(rn) würde
  // sie fälschlich gleichsetzen, deshalb hier r.name statt rn.
  const nextDifferent = scored.find((s) => s.r.name !== best?.name);
  const gap = nextDifferent ? scored[0].score - nextDifferent.score : Infinity;
  // Extra-Fall, den der Score-Abstand allein nicht sauber abbildet: eine
  // andersbenannte Karte mit exakt derselben Nummer, ohne dass eine
  // Set-Angabe das auflösen konnte (z.B. "Starmie" #30 gibt es sowohl in
  // BREAKthrough als auch als "Starmie δ" in Delta Species) - dann ist der
  // Nummern-Bonus bei beiden gleich groß, das kaschiert die eigentliche
  // Verwechslungsgefahr im Gesamt-Score. Nur relevant, wenn die andere Karte
  // selbst auch namentlich nah dran ist (nameScore >= 12, also mindestens ein
  // Präfix-Treffer) - sonst zählt jede zufällige Nummerngleichheit mit einer
  // völlig unbeteiligten Karte (z.B. "Radiant Gardevoir" #69 zu "Gardevoir"
  // #69) fälschlich als Kollision, obwohl niemand das verwechseln würde.
  const numberCollision =
    !set &&
    !!nn &&
    scored.some((s) => s.r.name !== best?.name && normNum(s.r.number) === nn && s.nameScore >= 12);
  // 15 statt 20: ein exakter Namenstreffer (+30) liegt zu einer bloß per
  // Präfix anschlagenden Sonder-Variante ("Charizard" -> "Charizard ex",
  // +12 minus Längen-Strafe) fast immer bei ~19 Punkten Abstand - das ist
  // schon eindeutig genug, keine echte Verwechslungsgefahr.
  const confidence =
    !best ? null : !numberCollision && scored[0].score >= 30 && gap >= 15 ? "high" : "low";

  return {
    best,
    candidates: scored.slice(0, 8).map((x) => x.r),
    confidence,
  };
}

const byExternalIdStmt = db.prepare(`
  SELECT c.*, s.release_date AS set_release_date, s.logo AS set_logo
  FROM cards c
  LEFT JOIN card_sets s ON s.id = c.set_id
  WHERE c.external_id = ? AND c.game_id = (SELECT id FROM games WHERE slug = 'pokemon')
`);

export function getCardByExternalIdLocal(externalId) {
  return rowToCard(byExternalIdStmt.get(externalId));
}

const setsStmt = db.prepare(`
  SELECT id, name, series, printed_total, total, release_date, logo, symbol
  FROM card_sets
  WHERE game_id = (SELECT id FROM games WHERE slug = 'pokemon')
  ORDER BY release_date DESC
`);

export function listSetsLocal() {
  return setsStmt.all().map(mapSetRow);
}

const setByIdStmt = db.prepare(`SELECT * FROM card_sets WHERE id = ?`);

export function getSetLocal(setId) {
  return mapSetRow(setByIdStmt.get(setId));
}

const cardsBySetStmt = db.prepare(`
  SELECT * FROM cards WHERE set_id = ?
  ORDER BY CAST(number AS INTEGER), number
`);

export function getCardsBySetLocal(setId) {
  return cardsBySetStmt.all(setId).map(rowToCard);
}

function mapSetRow(s) {
  if (!s) return null;
  return {
    id: s.id,
    name: s.name,
    series: s.series,
    release_date: s.release_date,
    total: s.total,
    printed_total: s.printed_total,
    logo: s.logo,
    symbol: s.symbol,
  };
}

export const cardDataImported = () =>
  db.prepare(`SELECT COUNT(*) AS n FROM cards WHERE raw_json IS NOT NULL`).get().n;
