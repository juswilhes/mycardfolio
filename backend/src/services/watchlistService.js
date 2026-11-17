import db from "../db/index.js";
import { slugOfCard } from "./cardSlugs.js";
import { latestTrend, cardmarketBreakdown } from "./cardService.js";

const insertWatch = db.prepare(`INSERT OR IGNORE INTO watchlist_items (user_id, card_id) VALUES (?, ?)`);

const deleteWatchByExternal = db.prepare(`
  DELETE FROM watchlist_items
  WHERE user_id = ? AND card_id = (SELECT id FROM cards WHERE external_id = ?)
`);

const listWatchStmt = db.prepare(`
  SELECT c.id AS card_id, c.external_id, c.name, c.set_name, c.number, c.rarity, c.artist,
         c.image_small, c.image_large, c.cardmarket_product_id, c.cardmarket_updated, c.cardmarket_page, c.cardmarket_expansion,
         wi.created_at
  FROM watchlist_items wi
  JOIN cards c ON c.id = wi.card_id
  WHERE wi.user_id = ?
  ORDER BY wi.created_at DESC
`);

const watchedExternalIdsStmt = db.prepare(`
  SELECT c.external_id
  FROM watchlist_items wi
  JOIN cards c ON c.id = wi.card_id
  WHERE wi.user_id = ?
`);

export function addToWatchlist(userId, cardId) {
  insertWatch.run(userId, cardId);
}

// true, wenn die Karte wirklich auf der Watchlist war (statt schon fehlte).
export function removeFromWatchlist(userId, externalId) {
  return deleteWatchByExternal.run(userId, externalId).changes > 0;
}

export function listWatchlist(userId) {
  return listWatchStmt.all(userId).map((item) => ({
    ...item,
    slug: slugOfCard(item.external_id),
    latest_price: latestTrend(item.card_id, "normal"),
    price_breakdown: cardmarketBreakdown(item.card_id),
  }));
}

export function watchedExternalIds(userId) {
  return watchedExternalIdsStmt.all(userId).map((r) => r.external_id);
}


// --- Sealed-Produkte (Justus 17.11.2026: "auch Sealed-Produkte auf die Watchlist") ---------------------------
const insertSealed = db.prepare(`INSERT OR IGNORE INTO watchlist_sealed (user_id, catalog_id) VALUES (?, ?)`);
const deleteSealed = db.prepare(`DELETE FROM watchlist_sealed WHERE user_id = ? AND catalog_id = ?`);
const catalogExists = db.prepare(`SELECT 1 FROM sealed_catalog WHERE id = ?`);
const listSealedStmt = db.prepare(`
  SELECT s.id AS catalog_id, s.name, s.image, s.price_cents, s.set_id, cs.name AS set_name, w.created_at
  FROM watchlist_sealed w
  JOIN sealed_catalog s ON s.id = w.catalog_id
  LEFT JOIN card_sets cs ON cs.id = s.set_id
  WHERE w.user_id = ?
  ORDER BY w.created_at DESC
`);
const sealedIdsStmt = db.prepare(`SELECT catalog_id FROM watchlist_sealed WHERE user_id = ?`);

// false, wenn es das Produkt im Katalog nicht gibt
export function addSealedToWatchlist(userId, catalogId) {
  if (!catalogExists.get(catalogId)) return false;
  insertSealed.run(userId, catalogId);
  return true;
}
export const removeSealedFromWatchlist = (userId, catalogId) => deleteSealed.run(userId, catalogId).changes > 0;
export const listSealedWatchlist = (userId) => listSealedStmt.all(userId);
export const watchedSealedIds = (userId) => sealedIdsStmt.all(userId).map((r) => r.catalog_id);
