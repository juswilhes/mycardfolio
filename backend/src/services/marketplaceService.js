// Datenzugriff für den Marktplatz: Angebote (Listings) und Bestellungen.
// Zahlungslogik selbst liegt in stripeConnect.js - hier nur SQLite.
import db from "../db/index.js";

// --- Verkäuferkonto (Stripe Connect) ---------------------------------------

const getSellerAccountStmt = db.prepare(`SELECT * FROM seller_accounts WHERE user_id = ?`);
export const getSellerAccount = (userId) => getSellerAccountStmt.get(userId);

const getSellerAccountByStripeIdStmt = db.prepare(
  `SELECT * FROM seller_accounts WHERE stripe_account_id = ?`
);
export const getSellerAccountByStripeId = (stripeAccountId) =>
  getSellerAccountByStripeIdStmt.get(stripeAccountId);

const insertSellerAccountStmt = db.prepare(`
  INSERT INTO seller_accounts (user_id, stripe_account_id) VALUES (?, ?)
`);
export function saveSellerAccount(userId, stripeAccountId) {
  insertSellerAccountStmt.run(userId, stripeAccountId);
}

const setOnboardingCompleteStmt = db.prepare(`
  UPDATE seller_accounts SET onboarding_complete = ?, updated_at = datetime('now') WHERE user_id = ?
`);
export const setOnboardingComplete = (userId, complete) =>
  setOnboardingCompleteStmt.run(complete ? 1 : 0, userId);

// --- Angebote (Listings) ----------------------------------------------------

const insertListingStmt = db.prepare(`
  INSERT INTO marketplace_listings (
    seller_user_id, kind, collection_item_id, sealed_product_id, external_id,
    title, image_url, price_cents, currency, quantity, condition, description
  ) VALUES (
    @seller_user_id, @kind, @collection_item_id, @sealed_product_id, @external_id,
    @title, @image_url, @price_cents, @currency, @quantity, @condition, @description
  )
`);

// Karte aus der eigenen Sammlung als Angebot einstellen. Titel/Bild werden
// als Schnappschuss übernommen (wie bei "sales") - bleibt stabil, auch wenn
// sich die Kartendaten später ändern.
const collectionItemForListingStmt = db.prepare(`
  SELECT ci.id, ci.user_id, ci.quantity, ci.condition,
         c.external_id, c.name, c.set_name, c.number, c.image_small
  FROM collection_items ci
  JOIN cards c ON c.id = ci.card_id
  WHERE ci.id = ? AND ci.user_id = ?
`);

export function createListingFromCollectionItem(userId, collectionItemId, { priceCents, description }) {
  const item = collectionItemForListingStmt.get(collectionItemId, userId);
  if (!item) return null;
  const info = insertListingStmt.run({
    seller_user_id: userId,
    kind: "card",
    collection_item_id: item.id,
    sealed_product_id: null,
    external_id: item.external_id,
    title: `${item.name} (${item.set_name} #${item.number})`,
    image_url: item.image_small,
    price_cents: priceCents,
    currency: "EUR",
    quantity: 1,
    condition: item.condition,
    description: description || null,
  });
  return info.lastInsertRowid;
}

const sealedProductForListingStmt = db.prepare(`
  SELECT id, user_id, name, set_name, image_url FROM sealed_products WHERE id = ? AND user_id = ?
`);

export function createListingFromSealedProduct(userId, sealedProductId, { priceCents, description }) {
  const item = sealedProductForListingStmt.get(sealedProductId, userId);
  if (!item) return null;
  const info = insertListingStmt.run({
    seller_user_id: userId,
    kind: "sealed",
    collection_item_id: null,
    sealed_product_id: item.id,
    external_id: null,
    title: item.set_name ? `${item.name} (${item.set_name})` : item.name,
    image_url: item.image_url,
    price_cents: priceCents,
    currency: "EUR",
    quantity: 1,
    condition: null,
    description: description || null,
  });
  return info.lastInsertRowid;
}

const listingByIdStmt = db.prepare(`SELECT * FROM marketplace_listings WHERE id = ?`);
export const getListingById = (id) => listingByIdStmt.get(id);

const activeListingsStmt = db.prepare(`
  SELECT l.*, u.display_name AS seller_name
  FROM marketplace_listings l
  JOIN users u ON u.id = l.seller_user_id
  WHERE l.status = 'active'
  ORDER BY l.created_at DESC
  LIMIT 200
`);
export const listActiveListings = () => activeListingsStmt.all();

const myListingsStmt = db.prepare(`
  SELECT * FROM marketplace_listings WHERE seller_user_id = ? ORDER BY created_at DESC
`);
export const listMyListings = (userId) => myListingsStmt.all(userId);

const cancelListingStmt = db.prepare(`
  UPDATE marketplace_listings SET status = 'cancelled', updated_at = datetime('now')
  WHERE id = ? AND seller_user_id = ? AND status = 'active'
`);
export const cancelListing = (userId, id) => cancelListingStmt.run(id, userId);

const markListingSoldStmt = db.prepare(`
  UPDATE marketplace_listings SET status = 'sold', updated_at = datetime('now') WHERE id = ?
`);
export const markListingSold = (id) => markListingSoldStmt.run(id);

// --- Bestellungen ------------------------------------------------------------

const insertOrderStmt = db.prepare(`
  INSERT INTO marketplace_orders (
    listing_id, buyer_user_id, seller_user_id, stripe_checkout_session_id,
    amount_cents, fee_cents, currency
  ) VALUES (
    @listing_id, @buyer_user_id, @seller_user_id, @stripe_checkout_session_id,
    @amount_cents, @fee_cents, @currency
  )
`);
export function createPendingOrder(values) {
  const info = insertOrderStmt.run(values);
  return info.lastInsertRowid;
}

const orderBySessionStmt = db.prepare(
  `SELECT * FROM marketplace_orders WHERE stripe_checkout_session_id = ?`
);
export const getOrderBySessionId = (sessionId) => orderBySessionStmt.get(sessionId);

const markOrderPaidStmt = db.prepare(`
  UPDATE marketplace_orders SET
    status = 'paid', stripe_payment_intent_id = @payment_intent_id,
    shipping_name = @shipping_name, shipping_address = @shipping_address,
    updated_at = datetime('now')
  WHERE stripe_checkout_session_id = @session_id
`);
export const markOrderPaid = (values) => markOrderPaidStmt.run(values);

const markOrderShippedStmt = db.prepare(`
  UPDATE marketplace_orders SET status = 'shipped', tracking_code = ?, updated_at = datetime('now')
  WHERE id = ? AND seller_user_id = ? AND status = 'paid'
`);
export const markOrderShipped = (id, sellerUserId, trackingCode) =>
  markOrderShippedStmt.run(trackingCode, id, sellerUserId);

const ordersAsBuyerStmt = db.prepare(`
  SELECT o.*, l.title, l.image_url FROM marketplace_orders o
  JOIN marketplace_listings l ON l.id = o.listing_id
  WHERE o.buyer_user_id = ? ORDER BY o.created_at DESC
`);
export const listOrdersAsBuyer = (userId) => ordersAsBuyerStmt.all(userId);

const ordersAsSellerStmt = db.prepare(`
  SELECT o.*, l.title, l.image_url FROM marketplace_orders o
  JOIN marketplace_listings l ON l.id = o.listing_id
  WHERE o.seller_user_id = ? ORDER BY o.created_at DESC
`);
export const listOrdersAsSeller = (userId) => ordersAsSellerStmt.all(userId);
