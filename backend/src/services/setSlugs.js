import db from "../db/index.js";
import { slugify } from "../lib/slug.js";

// Lesbare Set-Adressen: /sets/mega-evolution statt /sets/me1. Der Slug wird
// aus dem Set-Namen gebildet; bei gleichem Namen (oder wenn er einer anderen
// Set-ID entspräche) hängt die ID hinten dran. Die alten ID-Adressen leitet
// der Server per 301 auf die lesbare weiter (siehe seo.js redirectFor).
const allSetsStmt = db.prepare(`SELECT id, name FROM card_sets ORDER BY release_date ASC, id ASC`);

let slugById = null;
let idBySlug = null;

export function rebuildSetSlugs() {
  const rows = allSetsStmt.all();
  const ids = new Set(rows.map((r) => r.id));
  const byId = new Map();
  const bySlug = new Map();
  for (const r of rows) {
    let slug = slugify(r.name);
    // gleicher Name bereits vergeben oder Verwechslung mit einer anderen Set-ID -> ID anhängen
    if (!slug || bySlug.has(slug) || (ids.has(slug) && slug !== r.id)) slug = slug ? `${slug}-${r.id}` : r.id;
    byId.set(r.id, slug);
    bySlug.set(slug, r.id);
  }
  slugById = byId;
  idBySlug = bySlug;
}

export function slugOfSet(setId) {
  if (!slugById) rebuildSetSlugs();
  return slugById.get(setId) ?? setId;
}

// Set-ID zu einem URL-Teil, der Slug ODER (alt) die ID sein kann. Unbekanntes
// kommt unverändert zurück, damit die Routen wie bisher "nicht gefunden" melden.
export function resolveSetParam(param) {
  if (!idBySlug) rebuildSetSlugs();
  if (idBySlug.has(param)) return idBySlug.get(param);
  if (!slugById.has(param)) rebuildSetSlugs(); // neues Set seit dem letzten Aufbau?
  return idBySlug.get(param) ?? param;
}
