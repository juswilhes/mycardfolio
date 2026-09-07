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
  };
}

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

export function searchCardsLocal(query, { game = "pokemon", limit = 30 } = {}) {
  const terms = expandQuery(query);
  const likeClauses = terms.map(() => "c.name LIKE ? COLLATE NOCASE").join(" OR ");
  // Karten, deren Name mit einem der Begriffe BEGINNT, zuerst (z.B. "Charizard"
  // vor "Mega Charizard Y ex"), dann kürzere Namen, dann neueste Sets.
  const prefixClauses = terms.map(() => "c.name LIKE ? COLLATE NOCASE").join(" OR ");
  const stmt = db.prepare(`
    SELECT c.* FROM cards c
    LEFT JOIN card_sets s ON s.id = c.set_id
    WHERE c.game_id = (SELECT id FROM games WHERE slug = ?)
      AND (${likeClauses})
    ORDER BY
      CASE WHEN (${prefixClauses}) THEN 0 ELSE 1 END,
      LENGTH(c.name),
      s.release_date DESC,
      c.name
    LIMIT ?
  `);
  const params = [
    game,
    ...terms.map((t) => `%${t}%`),
    ...terms.map((t) => `${t}%`),
    limit,
  ];
  return stmt.all(...params).map(rowToCard);
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
