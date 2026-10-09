import db from "../db/index.js";
import { slugify } from "../lib/slug.js";
import { STARTER_ARTICLES } from "./articleSeeds.js";

// News & Artikel: eigene Texte des Betreibers (kein Fremdinhalt). Der Inhalt
// ist einfacher Text mit ##-Überschriften, - Listen, **fett** und [Links](...)
// - dargestellt von frontend/src/components/Prose.jsx.

const LIST_COLUMNS = "id, slug, title, summary, category, image, published, published_at, updated_at";

const listPublishedStmt = db.prepare(
  `SELECT ${LIST_COLUMNS} FROM articles WHERE published = 1 ORDER BY published_at DESC, id DESC LIMIT ?`
);
const listAllStmt = db.prepare(`SELECT ${LIST_COLUMNS} FROM articles ORDER BY published_at DESC, id DESC`);
const bySlugStmt = db.prepare(`SELECT * FROM articles WHERE slug = ?`);
const byIdStmt = db.prepare(`SELECT * FROM articles WHERE id = ?`);
const slugTakenStmt = db.prepare(`SELECT 1 FROM articles WHERE slug = ? AND id != ?`);
const insertStmt = db.prepare(`
  INSERT INTO articles (slug, title, summary, body, category, image, published, published_at)
  VALUES (@slug, @title, @summary, @body, @category, @image, @published, @published_at)
`);
const updateStmt = db.prepare(`
  UPDATE articles SET slug = @slug, title = @title, summary = @summary, body = @body, category = @category,
    image = @image, published = @published, published_at = @published_at, updated_at = datetime('now')
  WHERE id = @id
`);
const deleteStmt = db.prepare(`DELETE FROM articles WHERE id = ?`);
const countStmt = db.prepare(`SELECT COUNT(*) AS n FROM articles`);

export const listPublishedArticles = (limit = 100) => listPublishedStmt.all(limit);
export const listAllArticles = () => listAllStmt.all();
export const getArticleBySlug = (slug) => bySlugStmt.get(slug);
export const getArticleById = (id) => byIdStmt.get(id);

const today = () => new Date().toISOString().slice(0, 10);

// Eindeutiger Slug aus dem Titel (bei Doppelung -2, -3 ...)
function uniqueSlug(title, id = 0) {
  const base = slugify(title) || "artikel";
  let slug = base;
  for (let n = 2; slugTakenStmt.get(slug, id); n++) slug = `${base}-${n}`;
  return slug;
}

// Prüft die Eingaben des Editors; liefert { error } oder { values }.
function clean(input) {
  const title = String(input.title ?? "").trim();
  const summary = String(input.summary ?? "").trim();
  const body = String(input.body ?? "").trim();
  if (!title || title.length > 140) return { error: "Bitte einen Titel angeben (max. 140 Zeichen)." };
  if (!summary || summary.length > 300) return { error: "Bitte eine kurze Zusammenfassung angeben (max. 300 Zeichen)." };
  if (!body || body.length > 20000) return { error: "Bitte einen Text angeben (max. 20.000 Zeichen)." };
  // Titelbild: nur eigene Bilder (Upload oder mitgelieferte Titelbilder), nie fremde Adressen
  const image = String(input.image ?? "").trim();
  if (image && !/^\/(uploads\/news|news)\/[\w.-]+$/.test(image)) return { error: "Ungültiges Titelbild." };
  const date = String(input.published_at ?? "").trim();
  return {
    values: {
      title,
      summary,
      body,
      category: String(input.category ?? "").trim().slice(0, 30) || "News",
      image: image || null,
      published: input.published ? 1 : 0,
      published_at: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : today(),
    },
  };
}

export function createArticle(input) {
  const { error, values } = clean(input);
  if (error) return { error };
  const slug = uniqueSlug(values.title);
  const info = insertStmt.run({ ...values, slug });
  return { article: byIdStmt.get(info.lastInsertRowid) };
}

export function updateArticle(id, input) {
  const existing = byIdStmt.get(id);
  if (!existing) return { notFound: true };
  const { error, values } = clean(input);
  if (error) return { error };
  // Der Slug ist die öffentliche Adresse - bleibt beim Bearbeiten stabil
  updateStmt.run({ ...values, id, slug: existing.slug });
  return { article: byIdStmt.get(id) };
}

export const deleteArticle = (id) => deleteStmt.run(id).changes > 0;

// Beim ersten Start ein paar Artikel anlegen, damit der Bereich nicht leer ist.
// Danach nie wieder (auch nicht, wenn der Betreiber sie löscht).
const setImageIfMissingStmt = db.prepare(`UPDATE articles SET image = ? WHERE slug = ? AND image IS NULL`);

export function seedStarterArticles() {
  // Startartikel bekommen ihr Titelbild nachträglich, falls sie schon vor der
  // Bild-Funktion angelegt wurden (ändert nichts, wenn der Betreiber eines gesetzt hat).
  for (const a of STARTER_ARTICLES) if (a.image) setImageIfMissingStmt.run(a.image, a.slug);

  const done = db.prepare(`SELECT value FROM app_meta WHERE key = 'articles_seeded_v1'`).get();
  if (done) return;
  if (countStmt.get().n === 0) {
    for (const a of STARTER_ARTICLES) {
      insertStmt.run({ ...a, image: a.image ?? null, published: 1 });
    }
  }
  db.prepare(`INSERT OR REPLACE INTO app_meta (key, value) VALUES ('articles_seeded_v1', '1')`).run();
}
