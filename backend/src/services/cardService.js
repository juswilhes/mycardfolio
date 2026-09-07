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

const snapshotToday = db.prepare(`
  SELECT id FROM price_snapshots
  WHERE card_id = ? AND source = ? AND price_type = ? AND substr(fetched_at, 1, 10) = ?
  LIMIT 1
`);

const setCardmarketMeta = db.prepare(`
  UPDATE cards SET cardmarket_product_id = ?, cardmarket_updated = ? WHERE id = ?
`);

// Legt eine Karte an bzw. aktualisiert die Stammdaten. Preise NICHT hier -
// die kommen über recordPrices() aus dem priceProvider.
export function upsertCardRow(gameSlug, cardData) {
  const game = getGameId.get(gameSlug);
  if (!game) throw new Error(`Unbekanntes Spiel: ${gameSlug}`);

  return upsertCard.get({
    game_id: game.id,
    external_id: cardData.external_id,
    name: cardData.name,
    set_name: cardData.set_name ?? null,
    number: cardData.number ?? null,
    rarity: cardData.rarity ?? null,
    image_small: cardData.image_small ?? null,
    image_large: cardData.image_large ?? null,
  }).id;
}

// Schreibt Preis-Snapshots. Pro Tag/Quelle/Preistyp höchstens einen Wert,
// damit die Historie nicht durch mehrfache Abrufe am selben Tag zuwuchert.
export function recordPrices(cardId, prices = [], meta = null) {
  const day = new Date().toISOString().slice(0, 10);
  const now = new Date().toISOString();
  for (const p of prices) {
    if (snapshotToday.get(cardId, p.source, p.price_type, day)) continue;
    insertSnapshot.run(cardId, p.source, p.price_type, p.currency, p.price, now);
  }
  if (meta && (meta.productId != null || meta.updated != null)) {
    setCardmarketMeta.run(meta.productId ?? null, meta.updated ?? null, cardId);
  }
}

export const listCollection = db.prepare(`
  SELECT ci.id AS collection_item_id, ci.quantity, ci.condition,
         ci.purchase_price, ci.shipping_cost, ci.purchase_date, ci.currency, ci.notes, ci.language,
         c.id AS card_id, c.external_id, c.name, c.set_name, c.number, c.rarity,
         c.artist, c.image_small, c.image_large,
         c.cardmarket_product_id, c.cardmarket_updated
  FROM collection_items ci
  JOIN cards c ON c.id = ci.card_id
  ORDER BY ci.created_at DESC
`);

// Aktueller Referenzpreis = Trend in EUR. Bevorzugt Cardmarket; nur wenn
// Cardmarket für die Karte gar nichts hat, der aus USD umgerechnete
// TCGplayer-Wert. Immer genau EIN Wert pro Karte -> saubere Portfolio-Summe.
export const latestPriceForCard = db.prepare(`
  SELECT price, currency, price_type, source, fetched_at
  FROM price_snapshots
  WHERE card_id = ? AND price_type = 'trend'
  ORDER BY (source = 'cardmarket') DESC, fetched_at DESC
  LIMIT 1
`);

// Jüngster Wert je Preistyp (trend / low / avg30) für die Aufschlüsselung.
export const cardmarketBreakdownForCard = db.prepare(`
  SELECT price_type, price, currency, MAX(fetched_at) AS fetched_at
  FROM price_snapshots
  WHERE card_id = ? AND source = 'cardmarket'
  GROUP BY price_type
`);

// Trend-Verlauf (EUR) für den Graphen.
export const priceHistoryForCard = db.prepare(`
  SELECT price, currency, price_type, source, fetched_at
  FROM price_snapshots
  WHERE card_id = ? AND price_type = 'trend'
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
  WHERE c.external_id = ? AND ps.price_type = 'trend'
  ORDER BY ps.fetched_at ASC
`);

export const cardmarketBreakdownByExternalId = db.prepare(`
  SELECT ps.price_type, ps.price, ps.currency, MAX(ps.fetched_at) AS fetched_at
  FROM price_snapshots ps
  JOIN cards c ON c.id = ps.card_id
  WHERE c.external_id = ? AND ps.source = 'cardmarket'
  GROUP BY ps.price_type
`);

export const cardMetaByExternalId = db.prepare(`
  SELECT id, cardmarket_product_id, cardmarket_updated
  FROM cards
  WHERE external_id = ? AND game_id = (SELECT id FROM games WHERE slug = 'pokemon')
`);

export const latestPriceByExternalId = db.prepare(`
  SELECT ps.price, ps.currency, ps.price_type, ps.source, ps.fetched_at
  FROM price_snapshots ps
  JOIN cards c ON c.id = ps.card_id
  WHERE c.external_id = ? AND ps.price_type = 'trend'
  ORDER BY (ps.source = 'cardmarket') DESC, ps.fetched_at DESC
  LIMIT 1
`);
