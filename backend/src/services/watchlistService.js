import db from "../db/index.js";
import { latestTrend, cardmarketBreakdown } from "./cardService.js";

const insertWatch = db.prepare(`INSERT OR IGNORE INTO watchlist_items (user_id, card_id) VALUES (?, ?)`);

const deleteWatchByExternal = db.prepare(`
  DELETE FROM watchlist_items
  WHERE user_id = ? AND card_id = (SELECT id FROM cards WHERE external_id = ?)
`);

const listWatchStmt = db.prepare(`
  SELECT c.id AS card_id, c.external_id, c.name, c.set_name, c.number, c.rarity, c.artist,
         c.image_small, c.image_large, c.cardmarket_product_id, c.cardmarket_updated,
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
    latest_price: latestTrend(item.card_id, "normal"),
    price_breakdown: cardmarketBreakdown(item.card_id),
  }));
}

export function watchedExternalIds(userId) {
  return watchedExternalIdsStmt.all(userId).map((r) => r.external_id);
}
