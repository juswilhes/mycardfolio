import db from "../db/index.js";

const getGameId = db.prepare(`SELECT id FROM games WHERE slug = ?`);

const upsertCard = db.prepare(`
  INSERT INTO cards (game_id, external_id, name, set_name, number, rarity, image_small, image_large)
  VALUES (@game_id, @external_id, @name, @set_name, @number, @rarity, @image_small, @image_large)
  ON CONFLICT(game_id, external_id) DO UPDATE SET
    name=excluded.name, set_name=excluded.set_name, number=excluded.number,
    rarity=excluded.rarity, image_small=excluded.image_small, image_large=excluded.image_large
  RETURNING id
`);

const insertSnapshot = db.prepare(`
  INSERT INTO price_snapshots (card_id, source, price_type, currency, price, fetched_at)
  VALUES (?, ?, ?, ?, ?, ?)
`);

// Legt eine Karte an (oder aktualisiert sie) und schreibt die aktuellen Preise
// als neuen Snapshot. So entsteht mit der Zeit die Preishistorie fürs Diagramm.
export function saveCardWithPrices(gameSlug, cardData) {
  const game = getGameId.get(gameSlug);
  if (!game) throw new Error(`Unbekanntes Spiel: ${gameSlug}`);

  const cardId = upsertCard.get({
    game_id: game.id,
    external_id: cardData.external_id,
    name: cardData.name,
    set_name: cardData.set_name ?? null,
    number: cardData.number ?? null,
    rarity: cardData.rarity ?? null,
    image_small: cardData.image_small ?? null,
    image_large: cardData.image_large ?? null,
  }).id;

  const now = new Date().toISOString();
  for (const p of cardData.prices) {
    insertSnapshot.run(cardId, p.source, p.price_type, p.currency, p.price, now);
  }

  return cardId;
}

export const listCollection = db.prepare(`
  SELECT ci.id AS collection_item_id, ci.quantity, ci.condition,
         ci.purchase_price, ci.shipping_cost, ci.purchase_date, ci.currency, ci.notes,
         c.id AS card_id, c.external_id, c.name, c.set_name, c.number, c.rarity,
         c.artist, c.image_small, c.image_large
  FROM collection_items ci
  JOIN cards c ON c.id = ci.card_id
  ORDER BY ci.created_at DESC
`);

export const latestPriceForCard = db.prepare(`
  SELECT price, currency, price_type, source, fetched_at
  FROM price_snapshots
  WHERE card_id = ?
  ORDER BY fetched_at DESC
  LIMIT 1
`);

export const priceHistoryForCard = db.prepare(`
  SELECT price, currency, price_type, source, fetched_at
  FROM price_snapshots
  WHERE card_id = ?
  ORDER BY fetched_at ASC
`);

export const allCardsForGame = db.prepare(`
  SELECT c.id, c.external_id, g.slug AS game_slug
  FROM cards c JOIN games g ON g.id = c.game_id
`);

export const cardIdByExternalId = db.prepare(`
  SELECT id FROM cards
  WHERE external_id = ? AND game_id = (SELECT id FROM games WHERE slug = 'pokemon')
`);

// Illustrator manuell setzen. artist_manual = 1 schützt den Wert davor,
// beim nächsten `npm run import` überschrieben zu werden.
export const setArtistManual = db.prepare(`
  UPDATE cards SET artist = ?, artist_source = 'manual', artist_manual = 1
  WHERE external_id = ? AND game_id = (SELECT id FROM games WHERE slug = 'pokemon')
`);

export const priceHistoryByExternalId = db.prepare(`
  SELECT ps.price, ps.currency, ps.price_type, ps.source, ps.fetched_at
  FROM price_snapshots ps
  JOIN cards c ON c.id = ps.card_id
  WHERE c.external_id = ?
  ORDER BY ps.fetched_at ASC
`);
