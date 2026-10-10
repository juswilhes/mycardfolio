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
  INSERT INTO price_snapshots (card_id, source, price_type, currency, price, variant, fetched_at)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

const snapshotToday = db.prepare(`
  SELECT id FROM price_snapshots
  WHERE card_id = ? AND source = ? AND price_type = ? AND variant = ? AND substr(fetched_at, 1, 10) = ?
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
const markCorrectedStmt = db.prepare(`UPDATE cards SET price_valid_from = COALESCE(price_valid_from, ?) WHERE id = ?`);
const deleteDaySnapshotsStmt = db.prepare(`DELETE FROM price_snapshots WHERE card_id = ? AND substr(fetched_at, 1, 10) = ?`);

export function recordPrices(cardId, prices = [], meta = null) {
  const day = new Date().toISOString().slice(0, 10);
  const now = new Date().toISOString();
  if (meta?.corrected) {
    // Preise stammen aus der Gegenprüfung (TCGdex hatte das falsche Produkt): frühere
    // Werte gelten nicht mehr, ein heute schon gespeicherter falscher Wert wird ersetzt.
    markCorrectedStmt.run(`${day}T00:00:00.000Z`, cardId);
    deleteDaySnapshotsStmt.run(cardId, day);
  }
  for (const p of prices) {
    const variant = p.variant ?? "normal";
    if (snapshotToday.get(cardId, p.source, p.price_type, variant, day)) continue;
    insertSnapshot.run(cardId, p.source, p.price_type, p.currency, p.price, variant, now);
  }
  if (meta && (meta.productId != null || meta.updated != null)) {
    setCardmarketMeta.run(meta.productId ?? null, meta.updated ?? null, cardId);
  }
}

const listCollectionStmt = db.prepare(`
  SELECT ci.id AS collection_item_id, ci.quantity, ci.condition,
         ci.purchase_price, ci.shipping_cost, ci.purchase_date, ci.currency, ci.notes,
         ci.language, ci.variant, ci.grading_company, ci.grade,
         c.id AS card_id, c.external_id, c.name, c.set_name, c.set_id, c.number, c.rarity,
         c.artist, c.image_small, c.image_large,
         c.cardmarket_product_id, c.cardmarket_updated,
         (SELECT l.id FROM marketplace_listings l
           WHERE l.collection_item_id = ci.id AND l.status = 'active'
           ORDER BY l.id DESC LIMIT 1) AS listing_id
  FROM collection_items ci
  JOIN cards c ON c.id = ci.card_id
  WHERE ci.user_id = ?
  ORDER BY ci.created_at DESC
`);

// Sammlung EINES Nutzers.
export const listCollection = {
  all: (userId) => listCollectionStmt.all(userId),
};

const DAY_MS = 24 * 60 * 60 * 1000;
const round2 = (x) => Math.round(x * 100) / 100;

// Ausreißer-Filter: Der Cardmarket-Trend springt bei dünnem Handel gelegentlich
// für einen einzelnen Tag weit weg (z. B. 36 € -> 85 € -> 36 €), obwohl sich
// der Marktpreis nicht so bewegt hat. Ein Punkt gilt als Ausreißer, wenn er
// sich gegenüber dem Vortag um mehr als SPIKE_FACTOR verändert UND der nächste
// Tag wieder näher am alten Niveau liegt. Er wird dann durch den Vortagswert
// ersetzt. Hält das neue Niveau (nächster Tag ähnlich), ist es ein echter
// Sprung und bleibt. Der jüngste Punkt kann noch nicht bestätigt werden: bei
// einem solchen Sprung zeigen wir bis zur nächsten Nacht den Vortagswert.
// Gespeichert bleiben immer die Rohdaten. Preise unter SPIKE_MIN_PRICE sind
// zu klein für sinnvolle Prozentwerte.
const SPIKE_FACTOR = 1.4;
const SPIKE_MIN_PRICE = 2;
const ratio = (a, b) => Math.max(a / b, b / a);

function despike(points) {
  const out = [];
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const prev = out[out.length - 1]; // schon bereinigter Vortag
    const next = points[i + 1];
    const jumped = prev && Math.max(p.price, prev.price) >= SPIKE_MIN_PRICE && ratio(p.price, prev.price) > SPIKE_FACTOR;
    const reverts = !next || ratio(next.price, prev?.price ?? next.price) < ratio(next.price, p.price);
    out.push(jumped && reverts ? { ...p, price: prev.price } : p);
  }
  return out;
}

// Preisreihe einer Karte = die echten Tageswerte (Cardmarket-Trend). Der
// Graph zeigt genau diese Reihe, und der "Aktuelle Preis" ist ihr letzter
// Punkt - deshalb stimmen beide immer überein. Der 30-Tage-Schnitt (avg30)
// ist nur eine Zusatzinfo. Cardmarket-Punkte haben Vorrang; nur wenn es für
// eine Variante keine gibt, zählen die TCGplayer-Ersatzwerte (in EUR).
// Zeilen: EINE Karte, älteste zuerst.
function priceSeriesFrom(rows) {
  const byVariant = new Map();
  for (const r of rows) {
    if (!byVariant.has(r.variant)) byVariant.set(r.variant, []);
    byVariant.get(r.variant).push(r);
  }
  const series = [];
  for (const [variant, list] of byVariant) {
    const cm = list.filter((r) => r.source === "cardmarket");
    series.push({ variant, points: despike(cm.length ? cm : list) });
  }
  return series;
}

// Schnitt der Punkte in den 30 Tagen bis einschließlich des letzten Punktes.
function avg30Of(points) {
  const last = points[points.length - 1];
  const from = Date.parse(last.fetched_at) - 30 * DAY_MS;
  const win = points.filter((p) => Date.parse(p.fetched_at) > from);
  return round2(win.reduce((sum, p) => sum + p.price, 0) / win.length);
}

const trendNewestStmt = db.prepare(`
  SELECT price, currency, price_type, source, variant, fetched_at
  FROM price_snapshots WHERE card_id = ? AND price_type = 'trend'
  ORDER BY fetched_at DESC LIMIT 150
`);
const trendAllStmt = db.prepare(`
  SELECT price, currency, price_type, source, variant, fetched_at
  FROM price_snapshots WHERE card_id = ? AND price_type = 'trend'
  ORDER BY fetched_at ASC
`);

// Cardmarket liefert je Karte zwei Preisspalten (normal und "-holo"), aber
// viele Karten gibt es nur in EINER Ausführung (z. B. Illustration Rare, Rare
// Holo): dort ist die zweite Spalte keine echte zweite Ausführung. Nach den
// Angaben aus cards.variant_flags (services/variantFlags.js):
//  - mindestens zwei Ausführungen (normal / holo / reverse): zwei Reihen. Die
//    erste ("normal") ist die Hauptspalte, die zweite die "-holo"-Spalte und
//    heißt "reverse" (sonst "holo"); alte, anders benannte Punkte zählen mit.
//    Gibt es kein "normal" (z. B. ältere Rare Holo: Holo + Reverse Holo),
//    heißt die erste Reihe "Holo" (baseLabel) statt "Normal".
//  - nur eine Ausführung: EINE Reihe ("normal"), ohne Sonder-Variante
//  - Angaben unbekannt: Reihen unverändert
const flagsStmt = db.prepare(`SELECT variant_flags, price_valid_from FROM cards WHERE id = ?`);

function alignToPrintings(cardId, allRows) {
  const card = flagsStmt.get(cardId);
  // Preise vor price_valid_from stammen vom falschen Cardmarket-Produkt (siehe priceProvider.js)
  const rows = card?.price_valid_from ? allRows.filter((r) => r.fetched_at >= card.price_valid_from) : allRows;
  const raw = card?.variant_flags;
  if (!raw) return rows;
  const flags = JSON.parse(raw);
  const twoPrintings = [flags.normal, flags.holo, flags.reverse].filter(Boolean).length >= 2;
  const special = flags.reverse ? "reverse" : "holo";
  const baseLabel = twoPrintings && !flags.normal ? "Holo" : null;
  const hasNormalRows = rows.some((r) => r.variant === "normal");
  return rows.flatMap((r) => {
    if (r.variant === "normal") return [baseLabel ? { ...r, baseLabel } : r];
    if (r.variant !== "holo" && r.variant !== "reverse") return [r];
    if (twoPrintings) return [{ ...r, variant: special }];
    return hasNormalRows ? [] : [{ ...r, variant: "normal" }]; // nur die Sonder-Spalte hat Preise: das ist dann DER Preis
  });
}

// Verlauf für den Graphen: alle Varianten (normal/holo/reverse), älteste zuerst.
function priceHistory(cardId) {
  return priceSeriesFrom(alignToPrintings(cardId, trendAllStmt.all(cardId)))
    .filter((s) => ["normal", "holo", "reverse"].includes(s.variant))
    .flatMap((s) => s.points)
    .sort((a, b) => a.fetched_at.localeCompare(b.fetched_at));
}

// Aktueller Preis einer Karte + Variante = letzter Punkt der Reihe oben (plus
// avg30 als Zusatzinfo). Fällt auf 'normal' zurück, wenn es für die Variante
// keinen eigenen Preis gibt, und dann auf irgendeine vorhandene Reihe. Es
// reichen die neuesten Zeilen (30-Tage-Fenster + Reserve).
export function latestTrend(cardId, variant = "normal") {
  const rows = alignToPrintings(cardId, trendNewestStmt.all(cardId).reverse());
  const series = priceSeriesFrom(rows);
  const pick = series.find((s) => s.variant === variant) ?? series.find((s) => s.variant === "normal") ?? series[0];
  return pick ? { ...pick.points[pick.points.length - 1], avg30: avg30Of(pick.points) } : null;
}

// Bereinigte Tagesreihe (wie im Graphen: Ausführungen, Ausreißer, gültig ab) der Variante,
// die jemand besitzt - mit denselben Rückfällen wie latestTrend. Für den Portfolio-Verlauf
// und die Bewegungen der Sammlung, damit eine Reverse-Holo-Karte nie mit dem Holo-Preis
// gerechnet wird.
export function variantSeries(cardId, variant = "normal") {
  const series = priceSeriesFrom(alignToPrintings(cardId, trendAllStmt.all(cardId)));
  const pick = series.find((s) => s.variant === variant) ?? series.find((s) => s.variant === "normal") ?? series[0];
  return pick?.points ?? [];
}

const cmBreakdownRows = db.prepare(`
  SELECT variant, price_type, price, currency, MAX(fetched_at) AS fetched_at
  FROM price_snapshots
  WHERE card_id = ? AND source = 'cardmarket'
  GROUP BY variant, price_type
`);
export function cardmarketBreakdown(cardId) {
  return cmBreakdownRows.all(cardId);
}

// Tagespunkte (Variante 'normal', ohne Quellen-Vorrang) für Preisbewegungen
// (marketStats.js) und Portfolio-Bewegung - ebenfalls ohne Ausreißer, damit
// überall dieselben Preise gelten.
const normalTrendStmt = db.prepare(`
  SELECT price, currency, price_type, source, fetched_at
  FROM price_snapshots
  WHERE card_id = ? AND price_type = 'trend' AND variant = 'normal'
  ORDER BY fetched_at ASC
`);
export const priceHistoryForCard = {
  all: (cardId) => {
    const from = flagsStmt.get(cardId)?.price_valid_from;
    const rows = normalTrendStmt.all(cardId);
    return despike(from ? rows.filter((r) => r.fetched_at >= from) : rows);
  },
};

// Illustrator manuell setzen. artist_manual = 1 schützt den Wert davor,
// beim nächsten `npm run import` überschrieben zu werden.
export const setArtistManual = db.prepare(`
  UPDATE cards SET artist = ?, artist_source = 'manual', artist_manual = 1
  WHERE external_id = ? AND game_id = (SELECT id FROM games WHERE slug = 'pokemon')
`);

const cardIdForExternal = db.prepare(`
  SELECT id FROM cards WHERE external_id = ? AND game_id = (SELECT id FROM games WHERE slug = 'pokemon')
`);

export function cardmarketBreakdownByExternal(externalId) {
  const row = cardIdForExternal.get(externalId);
  return row ? cardmarketBreakdown(row.id) : [];
}

export const cardMetaByExternalId = db.prepare(`
  SELECT id, cardmarket_product_id, cardmarket_updated, price_valid_from
  FROM cards
  WHERE external_id = ? AND game_id = (SELECT id FROM games WHERE slug = 'pokemon')
`);

export function latestTrendByExternal(externalId, variant = "normal") {
  const row = cardIdForExternal.get(externalId);
  return row ? latestTrend(row.id, variant) : null;
}

// Verlauf einer Karte per externer ID (Kartenseite).
export function priceHistoryByExternal(externalId) {
  const row = cardIdForExternal.get(externalId);
  return row ? priceHistory(row.id) : [];
}

const cardsOfSetStmt = db.prepare(`SELECT id, external_id FROM cards WHERE set_id = ?`);

// Aktueller Preis (siehe latestTrend) für ALLE Karten eines Sets - für die
// Set-Übersicht (Sortierung/Anzeige nach Preis). Dieselbe Rechnung wie auf
// der Kartenseite, deshalb überall derselbe Preis.
export function pricesForSet(setId) {
  const map = new Map();
  for (const c of cardsOfSetStmt.all(setId)) map.set(c.external_id, latestTrend(c.id, "normal")?.price ?? null);
  return map;
}

// Fortschritt je Set: wie viele verschiedene Karten aus dem Set besitzt der Nutzer?
const setProgressStmt = db.prepare(`
  SELECT c.set_id, COUNT(DISTINCT c.id) AS owned
  FROM collection_items ci JOIN cards c ON c.id = ci.card_id
  WHERE c.set_id IS NOT NULL AND ci.user_id = ?
  GROUP BY c.set_id
`);
export const setProgress = { all: (userId) => setProgressStmt.all(userId) };

// external_ids aller Karten eines Sets, die der Nutzer besitzt
const ownedInSetStmt = db.prepare(`
  SELECT DISTINCT c.external_id
  FROM collection_items ci JOIN cards c ON c.id = ci.card_id
  WHERE c.set_id = ? AND ci.user_id = ?
`);
export const ownedInSet = { all: (setId, userId) => ownedInSetStmt.all(setId, userId) };
