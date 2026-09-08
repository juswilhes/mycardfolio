// Flexibler Import-Parser: erkennt praktisch beliebige Tabellen (aus Excel
// kopiert, CSV, mit ; | oder Mehrfach-Leerzeichen, oder reine Namensliste)
// und rät die Bedeutung jeder Spalte aus Kopfzeile UND Zellinhalten.

const norm = (s) => (s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
const clean = (s) => String(s ?? "").trim();

// --- Vokabulare -------------------------------------------------------

const CONDITION_MAP = {
  sealed: "sealed", versiegelt: "sealed", ovp: "sealed", sealead: "sealed",
  mint: "mint", m: "mint", mt: "mint",
  nearmint: "near_mint", nm: "near_mint", nmmint: "near_mint",
  excellent: "excellent", ex: "excellent", exc: "excellent", exzellent: "excellent",
  good: "good", gd: "good", g: "good", gut: "good",
  lightplayed: "light_played", lp: "light_played", leichtgespielt: "light_played", lightlyplayed: "light_played",
  played: "played", pl: "played", pld: "played", gespielt: "played",
  moderatelyplayed: "played", mp: "played", moderatelplayed: "played",
  heavilyplayed: "poor", hp: "poor",
  poor: "poor", po: "poor", pr: "poor", schlecht: "poor", damaged: "poor", beschaedigt: "poor",
};
const LANG_MAP = {
  de: "de", deu: "de", ger: "de", deutsch: "de", german: "de", germany: "de",
  en: "en", eng: "en", englisch: "en", english: "en", uk: "en", us: "en",
};
const VARIANT_MAP = {
  normal: "normal", regular: "normal", standard: "normal", nonfoil: "normal", "": "normal",
  holo: "holo", holofoil: "holo", foil: "holo", rareholo: "holo", hf: "holo", glanz: "holo",
  reverse: "reverse", reverseholo: "reverse", reverseholofoil: "reverse", rev: "reverse", rh: "reverse",
  firstedition: "first_edition", "1stedition": "first_edition", "1st": "first_edition",
  first: "first_edition", erstauflage: "first_edition", edition1: "first_edition",
};
const BOOL_TRUE = new Set(["ja", "yes", "y", "true", "1", "x", "wahr"]);
const BOOL_FALSE = new Set(["nein", "no", "n", "false", "0", "", "falsch"]);

export const normCondition = (v) => CONDITION_MAP[norm(v)] ?? null;
export const normLanguage = (v) => LANG_MAP[norm(v)] ?? null;
export const normVariant = (v) => VARIANT_MAP[norm(v)] ?? null;

const HEADER_ALIASES = {
  name: ["name", "karte", "card", "kartenname", "cardname", "bezeichnung", "titel", "title", "produkt", "product", "englishname", "namede", "nameen"],
  number: ["nummer", "nr", "no", "number", "num", "kartennummer", "cardnumber", "collectornumber", "cardno", "setnumber"],
  set: ["set", "edition", "expansion", "erweiterung", "serie", "series", "setname", "expansionname"],
  quantity: ["menge", "anzahl", "quantity", "qty", "qnt", "count", "amount", "stück", "stueck", "stk", "have", "besitz"],
  price: ["kaufpreis", "preis", "price", "purchaseprice", "paid", "pricepaid", "ek", "einkaufspreis", "cost", "value", "wert", "buyprice", "einstand"],
  shipping: ["versand", "shipping", "porto", "versandkosten", "shippingcost"],
  condition: ["zustand", "condition", "cond", "conditon", "grading", "grade", "erhaltung", "quali", "quality"],
  language: ["sprache", "language", "lang", "sprachen"],
  variant: ["variante", "variant", "foil", "foilq", "isfoil", "printing", "druck", "finish", "holofoil", "parallel"],
  date: ["kaufdatum", "datum", "date", "purchasedate", "boughton", "gekauftam", "acquired"],
  notes: ["notiz", "notiz", "notes", "note", "kommentar", "comment", "bemerkung", "anmerkung", "remark"],
  rarity: ["seltenheit", "rarity", "rareness", "rare"],
};
const ALIAS_TO_FIELD = {};
for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
  for (const a of aliases) ALIAS_TO_FIELD[a] = field;
}

// --- Grid-Erkennung --------------------------------------------------

function splitCSVish(line, delim) {
  const out = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (q && line[i + 1] === '"') { cur += '"'; i++; }
      else q = !q;
    } else if (ch === delim && !q) {
      out.push(cur); cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out.map(clean);
}

function mode(arr) {
  const m = new Map();
  for (const v of arr) m.set(v, (m.get(v) ?? 0) + 1);
  let best = arr[0], bestN = 0;
  for (const [v, n] of m) if (n > bestN) { best = v; bestN = n; }
  return best;
}
const pad = (row, n) => (row.length >= n ? row.slice(0, n) : [...row, ...Array(n - row.length).fill("")]);

function toGrid(lines) {
  // 1) übliche Trennzeichen: nur nehmen, wenn sie in fast jeder Zeile stehen
  //    und die Spaltenzahl konsistent ist
  for (const d of ["\t", ";", "|"]) {
    if (lines.filter((l) => l.includes(d)).length >= lines.length * 0.7) {
      const g = lines.map((l) => splitCSVish(l, d));
      const cols = mode(g.map((r) => r.length));
      if (cols >= 2 && g.filter((r) => r.length === cols).length >= lines.length * 0.6) {
        return g.map((r) => pad(r, cols));
      }
    }
  }
  // 2) Komma: akzeptieren, wenn JEDE Zeile gleich viele Felder hat
  //    (Pokémon-Namen enthalten keine Kommas)
  if (lines.every((l) => l.includes(","))) {
    const g = lines.map((l) => splitCSVish(l, ","));
    const cols = g[0].length;
    if (cols >= 2 && g.every((r) => r.length === cols)) {
      return g;
    }
  }
  // 3) aus Text kopierte Tabellen: 2+ Leerzeichen oder " - " / " | " / " / "
  for (const re of [/ {2,}| {0,}\t/, / +[-|/] +/]) {
    const g = lines.map((l) => l.split(re).map(clean).filter((_, i, a) => a.length === 1 || true));
    const cols = mode(g.map((r) => r.length));
    if (cols >= 2 && g.filter((r) => r.length === cols).length >= lines.length * 0.7) {
      return g.map((r) => pad(r, cols));
    }
  }
  // 4) eine Spalte – evtl. steckt trotzdem eine Nummer / Menge im Text,
  //    das löst der Server beim Abgleich (splitNumber) bzw. buildRow unten
  return lines.map((l) => [clean(l)]);
}

// --- Header erkennen -----------------------------------------------

function isHeaderRow(row, dataRows) {
  if (row.some((c) => ALIAS_TO_FIELD[norm(c)])) return true;
  if (!dataRows.length) return false;
  // Heuristik: Header-Zellen sind kurz & nicht-numerisch, während die
  // Spalte darunter Zahlen enthält
  let signal = 0;
  row.forEach((c, i) => {
    const below = dataRows.map((r) => r[i] ?? "");
    const belowNumeric = below.filter((v) => /\d/.test(v)).length;
    const headerNumeric = /^\s*[\d.,]+\s*$/.test(c);
    if (!headerNumeric && belowNumeric > below.length / 2 && c.length > 0 && c.length < 24) signal++;
  });
  return signal >= 1;
}

// --- Spalten-Bewertung -------------------------------------------

const RX_NUMBER = /^#?\s*([a-z]{0,4}\d{1,4}[a-z]?)(\s*\/\s*\S+)?$/i;
const RX_PRICE = /(\d+[.,]\d{1,2})|([€$£]\s*\d)|(\d+\s*(eur|usd|€|\$))/i;
const RX_QTY = /^\s*(x?\s*\d{1,3}|\d{1,3}\s*x)\s*$/i;
const RX_DATE = /^\s*(\d{1,4}[.\-/]\d{1,2}[.\-/]\d{1,4}|\d{4}-\d{2}-\d{2})\s*$/;

const frac = (vals, pred) => {
  const nonEmpty = vals.filter((v) => clean(v) !== "");
  if (!nonEmpty.length) return 0;
  return nonEmpty.filter(pred).length / nonEmpty.length;
};

// laufende Nummer / Zeilenindex (1,2,3,…) -> ignorieren
const IGNORE_HEADERS = new Set(["pos", "position", "index", "idx", "lfd", "lfdnr", "zeile", "row", "id", "rownumber"]);

function scoreColumn(vals) {
  const nonEmpty = vals.map(clean).filter(Boolean);
  const uniq = new Set(nonEmpty.map((v) => v.toLowerCase())).size;
  const avgLen = nonEmpty.reduce((s, v) => s + v.length, 0) / (nonEmpty.length || 1);
  const alpha = frac(vals, (v) => /[a-zäöüß]/i.test(v));
  const wordy = frac(vals, (v) => v.trim().split(/\s+/).length >= 2);

  // perfekte 1,2,3,… -Folge -> das ist ein Zeilenindex, keine Karten-Nummer/Menge
  const isSequence =
    nonEmpty.length >= 3 &&
    nonEmpty.every((v, i) => /^\d+$/.test(v) && parseInt(v, 10) === i + 1);
  if (isSequence) {
    return { _ignore: true, name: 0, number: 0, quantity: 0, price: 0, condition: 0, language: 0, variant: 0, date: 0, set: 0, rarity: 0 };
  }

  return {
    number: frac(vals, (v) => RX_NUMBER.test(v.trim())) * (avgLen < 10 ? 1 : 0.4),
    price: Math.max(
      frac(vals, (v) => RX_PRICE.test(v)),
      frac(vals, (v) => /^\s*\d+[.,]\d{1,2}\s*€?\s*$/.test(v)) * 0.9
    ),
    quantity: frac(vals, (v) => RX_QTY.test(v)) *
      (frac(vals, (v) => /[.,]\d/.test(v)) > 0.3 ? 0.3 : 1),
    condition: frac(vals, (v) => CONDITION_MAP[norm(v)] != null),
    language: frac(vals, (v) => LANG_MAP[norm(v)] != null),
    variant: Math.max(
      frac(vals, (v) => VARIANT_MAP[norm(v)] != null && norm(v) !== ""),
      frac(vals, (v) => BOOL_TRUE.has(norm(v)) || BOOL_FALSE.has(norm(v))) * 0.5
    ),
    date: frac(vals, (v) => RX_DATE.test(v)),
    // Name: viel Text, mehrere Wörter, hohe Eindeutigkeit
    name: (alpha * 0.5 + wordy * 0.3) *
      (avgLen >= 4 ? 1 : 0.3) *
      (uniq >= nonEmpty.length * 0.7 ? 1 : 0.6),
    // Set: Text, aber deutlich weniger eindeutig als der Name
    set: alpha * 0.6 * (uniq <= Math.max(1, nonEmpty.length * 0.6) ? 1 : 0.3) * (avgLen >= 3 ? 1 : 0.3),
    rarity: frac(vals, (v) => /\b(common|uncommon|rare|holo|secret|illustration|promo|hyper|ultra|amazing|radiant|shiny)\b/i.test(v)),
  };
}

const FIELDS = ["name", "number", "quantity", "price", "shipping", "condition", "language", "variant", "date", "set", "rarity", "notes"];

function inferColumns(header, dataRows) {
  const nCols = Math.max(...dataRows.map((r) => r.length), header?.length ?? 0);
  const colVals = [];
  for (let i = 0; i < nCols; i++) colVals.push(dataRows.map((r) => r[i] ?? ""));

  const scores = colVals.map((vals, i) => {
    const s = scoreColumn(vals);
    if (s._ignore) return s;
    if (header) {
      const hn = norm(header[i] ?? "");
      if (IGNORE_HEADERS.has(hn)) {
        for (const k of Object.keys(s)) s[k] = 0;
        return s;
      }
      const f = ALIAS_TO_FIELD[hn];
      if (f && s[f] != null) s[f] += 0.6; // Kopfzeile ist ein starker Hinweis
      if (f === "notes") s.notes = 0.9;
      if (f === "shipping") s.shipping = 0.9;
    }
    return s;
  });

  // (Spalte, Feld, Score) absteigend, gierig zuweisen
  const triples = [];
  scores.forEach((s, col) => {
    for (const field of FIELDS) triples.push([col, field, s[field] ?? 0]);
  });
  triples.sort((a, b) => b[2] - a[2]);

  const colTaken = new Set();
  const assign = {};
  for (const [col, field, sc] of triples) {
    if (sc < 0.25) break;
    if (assign[field] != null || colTaken.has(col)) continue;
    assign[field] = col;
    colTaken.add(col);
  }

  // Name ist Pflicht: beste noch freie Textspalte nehmen
  if (assign.name == null) {
    let best = -1, bestSc = -1;
    scores.forEach((s, col) => {
      if (!colTaken.has(col) && s.name > bestSc) { bestSc = s.name; best = col; }
    });
    if (best === -1) best = 0;
    assign.name = best;
    colTaken.add(best);
  }
  return assign;
}

// --- Zellen aufbereiten -------------------------------------------

const parsePrice = (v) => {
  const s = clean(v).replace(/[^\d.,-]/g, "");
  if (!s) return null;
  // "1.234,56" -> 1234.56 ; "12.50" -> 12.50 ; "12,50" -> 12.50
  let t = s;
  if (/,\d{1,2}$/.test(t)) t = t.replace(/\./g, "").replace(",", ".");
  else t = t.replace(/,/g, "");
  const n = parseFloat(t);
  return Number.isFinite(n) ? n : null;
};
const parseQty = (v) => {
  const m = clean(v).match(/\d{1,4}/);
  return m ? parseInt(m[0], 10) : null;
};
const parseNumber = (v) => {
  const m = clean(v).match(RX_NUMBER);
  return m ? m[1].toUpperCase() : clean(v).replace(/^#/, "") || null;
};

// "Charizard ex (Obsidian Flames)" -> { name, set }
function stripParenthetical(name) {
  const m = name.match(/^(.*?)[\s]*[([{]([^)\]}]+)[)\]}]\s*$/);
  if (m && m[1].trim()) return { name: m[1].trim(), extraSet: m[2].trim() };
  return { name, extraSet: null };
}

function buildRow(cells, assign) {
  const at = (f) => (assign[f] != null ? clean(cells[assign[f]]) : "");
  let name = at("name");
  let set = at("set") || null;

  const par = stripParenthetical(name);
  name = par.name;
  if (!set && par.extraSet) set = par.extraSet;

  const variantRaw = at("variant");
  let variant = normVariant(variantRaw);
  if (!variant && BOOL_TRUE.has(norm(variantRaw))) variant = "holo";
  if (!variant && assign.variant != null && BOOL_FALSE.has(norm(variantRaw))) variant = "normal";

  return {
    name,
    number: at("number") ? parseNumber(at("number")) : null,
    set,
    quantity: at("quantity") ? String(parseQty(at("quantity")) ?? "") : null,
    price: at("price") ? String(parsePrice(at("price")) ?? "") : null,
    shipping: at("shipping") ? String(parsePrice(at("shipping")) ?? "") : null,
    condition: normCondition(at("condition")),
    language: normLanguage(at("language")),
    variant,
    date: at("date") || null,
    notes: at("notes") || null,
    raw: cells.filter(Boolean).join(" · "),
  };
}

// --- Einstieg ----------------------------------------------------

export function parseImport(text) {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+$/, ""))
    .filter((l) => l.trim());
  if (!lines.length) return { rows: [], assignment: {}, header: null };

  const grid = toGrid(lines);
  const header = isHeaderRow(grid[0], grid.slice(1)) ? grid[0] : null;
  const dataRows = header ? grid.slice(1) : grid;
  if (!dataRows.length) return { rows: [], assignment: {}, header };

  const assignment = inferColumns(header, dataRows);
  const rows = dataRows.map((cells) => buildRow(cells, assignment)).filter((r) => r.name);

  return { rows, assignment, header };
}
