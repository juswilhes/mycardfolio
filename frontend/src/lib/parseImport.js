// Parst eingefügten Text (CSV, aus Excel kopierte Tabelle = Tab-getrennt,
// oder einfache Liste) in Zeilen mit erkannten Feldern.

const HEADER_ALIASES = {
  name: ["name", "karte", "card", "kartenname", "cardname", "bezeichnung"],
  number: ["nummer", "nr", "number", "no", "kartennummer", "cardnumber", "collectornumber"],
  set: ["set", "edition", "expansion", "serie", "series"],
  quantity: ["menge", "anzahl", "quantity", "qty", "count", "stück", "stueck", "stk"],
  price: ["kaufpreis", "preis", "price", "purchaseprice", "paid", "ek", "einkaufspreis"],
  shipping: ["versand", "shipping", "porto", "versandkosten"],
  condition: ["zustand", "condition", "cond", "grading", "erhaltung"],
  language: ["sprache", "language", "lang"],
  variant: ["variante", "variant", "foil", "printing", "druck"],
  date: ["kaufdatum", "datum", "date", "purchasedate"],
  notes: ["notiz", "notes", "kommentar", "comment", "bemerkung", "note"],
};

const norm = (s) => (s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");

const CONDITION_MAP = {
  sealed: "sealed", versiegelt: "sealed", ovp: "sealed",
  mint: "mint", m: "mint",
  nearmint: "near_mint", nm: "near_mint", "nm-": "near_mint",
  excellent: "excellent", ex: "excellent", exzellent: "excellent",
  good: "good", gd: "good", gut: "good",
  lightplayed: "light_played", lp: "light_played", "leichtgespielt": "light_played",
  played: "played", pl: "played", gespielt: "played",
  moderatelyplayed: "played", mp: "played",
  heavilyplayed: "poor", hp: "poor",
  poor: "poor", po: "poor", schlecht: "poor", damaged: "poor",
};
const LANG_MAP = {
  de: "de", deutsch: "de", german: "de", ger: "de",
  en: "en", englisch: "en", english: "en", eng: "en",
};
const VARIANT_MAP = {
  normal: "normal", regular: "normal", "": "normal",
  holo: "holo", holofoil: "holo", foil: "holo", rareholo: "holo",
  reverse: "reverse", reverseholo: "reverse", reverseholofoil: "reverse", rev: "reverse",
  firstedition: "first_edition", "1stedition": "first_edition", "1st": "first_edition", erstauflage: "first_edition",
};

export const normCondition = (v) => CONDITION_MAP[norm(v)] ?? null;
export const normLanguage = (v) => LANG_MAP[norm(v)] ?? null;
export const normVariant = (v) => VARIANT_MAP[norm(v)] ?? null;

function detectDelimiter(text) {
  const line = text.split(/\r?\n/).find((l) => l.trim());
  if (!line) return null;
  if (line.includes("\t")) return "\t";
  if (line.includes(";")) return ";";
  // Komma nur, wenn mehrere Felder plausibel sind
  if ((line.match(/,/g) || []).length >= 1 && !/^\s*[^,]+,\s*\d/.test(line) === false) return ",";
  if (line.includes(",")) return ",";
  return null;
}

function splitLine(line, delim) {
  if (!delim) return [line];
  // einfache CSV-Behandlung mit Anführungszeichen
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
  return out.map((s) => s.trim());
}

function matchHeader(cells) {
  const map = {};
  cells.forEach((cell, idx) => {
    const n = norm(cell);
    for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
      if (aliases.includes(n)) map[field] = idx;
    }
  });
  // als Header gilt: mindestens "name" plus ein weiteres Feld erkannt
  return map.name != null && Object.keys(map).length >= 2 ? map : null;
}

export function parseImport(text) {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return { rows: [], hadHeader: false };

  const delim = detectDelimiter(text);
  const table = lines.map((l) => splitLine(l, delim));

  let headerMap = matchHeader(table[0]);
  const dataRows = headerMap ? table.slice(1) : table;

  const rows = dataRows.map((cells) => {
    if (headerMap) {
      const g = (f) => (headerMap[f] != null ? (cells[headerMap[f]] ?? "").trim() : "");
      return {
        name: g("name"),
        number: g("number") || null,
        set: g("set") || null,
        quantity: g("quantity") || null,
        price: g("price") || null,
        shipping: g("shipping") || null,
        condition: g("condition") || null,
        language: g("language") || null,
        variant: g("variant") || null,
        date: g("date") || null,
        notes: g("notes") || null,
        raw: cells.join(" · "),
      };
    }
    // kein Header: erstes Feld = Name (kann Nummer enthalten), Rest heuristisch
    const [first, ...rest] = cells;
    let quantity = null;
    let price = null;
    for (const r of rest) {
      const v = r.replace(",", ".").replace(/[^\d.]/g, "");
      if (!v) continue;
      if (/^\d+$/.test(v) && quantity == null) quantity = v;
      else if (price == null) price = v;
    }
    return {
      name: (first ?? "").trim(),
      number: null,
      set: rest.find((r) => /[a-zA-Z]/.test(r) && !/^\d/.test(r)) || null,
      quantity,
      price,
      shipping: null,
      condition: null,
      language: null,
      variant: null,
      date: null,
      notes: null,
      raw: cells.join(" · "),
    };
  });

  return { rows: rows.filter((r) => r.name), hadHeader: !!headerMap };
}
