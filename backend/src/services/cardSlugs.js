import db from "../db/index.js";
import { slugify } from "../lib/slug.js";
import { slugOfSet } from "./setSlugs.js";

// Lesbare Karten-Adressen im Stil der Set-Adressen: /database/arceus-60-gengar statt
// /database/pl4-60 (Set-Name + Kartennummer + Kartenname). Die API und die Seite nehmen
// Slug ODER die alte ID; alte ID-Adressen leitet der Server per 301 um (seo.js redirectFor).
const allCardsStmt = db.prepare(`
  SELECT external_id, name, number, set_id, set_name FROM cards
  WHERE game_id = (SELECT id FROM games WHERE slug = 'pokemon')
  ORDER BY external_id
`);

let slugById = null;
let idBySlug = null;
let builtAt = 0;

export function rebuildCardSlugs() {
  const byId = new Map();
  const bySlug = new Map();
  for (const c of allCardsStmt.all()) {
    const setPart = c.set_id ? slugOfSet(c.set_id) : slugify(c.set_name ?? "");
    const name = slugify(c.name ?? "").slice(0, 40).replace(/-+$/, "");
    let slug = [setPart, slugify(c.number ?? ""), name].filter(Boolean).join("-") || slugify(c.external_id);
    if (bySlug.has(slug)) slug = `${slug}-${slugify(c.external_id)}`; // zwei Karten, gleiche Adresse: ID anhängen
    byId.set(c.external_id, slug);
    bySlug.set(slug, c.external_id);
  }
  slugById = byId;
  idBySlug = bySlug;
  builtAt = Date.now();
}

export function slugOfCard(externalId) {
  if (!slugById) rebuildCardSlugs();
  return slugById.get(externalId) ?? externalId;
}

// ID zu einem URL-Teil, der Slug ODER (alt) die ID sein kann. Unbekanntes kommt
// unverändert zurück, damit die Routen wie bisher "nicht gefunden" melden.
export function resolveCardParam(param) {
  if (!idBySlug) rebuildCardSlugs();
  if (idBySlug.has(param)) return idBySlug.get(param);
  // neue Karte seit dem letzten Aufbau? (höchstens einmal pro Minute, sonst könnte jeder
  // erfundene Link den Aufbau auslösen)
  if (!slugById.has(param) && Date.now() - builtAt > 60_000) rebuildCardSlugs();
  return idBySlug.get(param) ?? param;
}
