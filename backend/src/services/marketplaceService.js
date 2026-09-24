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

// Bewertungsschnitt + Anzahl je Verkäufer, als Unterabfrage an jedes Angebot
// gehängt - Vertrauen soll schon in der Übersicht sichtbar sein, nicht erst
// nach einem Klick.
const SELLER_RATING_SUBQUERY = `
  (SELECT ROUND(AVG(rating), 1) FROM marketplace_reviews WHERE reviewee_user_id = l.seller_user_id) AS seller_rating,
  (SELECT COUNT(*) FROM marketplace_reviews WHERE reviewee_user_id = l.seller_user_id) AS seller_review_count
`;

const activeListingsStmt = db.prepare(`
  SELECT l.*, u.display_name AS seller_name, ${SELLER_RATING_SUBQUERY}
  FROM marketplace_listings l
  JOIN users u ON u.id = l.seller_user_id
  WHERE l.status = 'active'
  ORDER BY l.created_at DESC
  LIMIT 200
`);
export const listActiveListings = () => activeListingsStmt.all();

const listingWithSellerStmt = db.prepare(`
  SELECT l.*, u.display_name AS seller_name, u.id AS seller_id, ${SELLER_RATING_SUBQUERY}
  FROM marketplace_listings l
  JOIN users u ON u.id = l.seller_user_id
  WHERE l.id = ?
`);
export const getListingWithSeller = (id) => listingWithSellerStmt.get(id);

const setListingPhotoStmt = db.prepare(`
  UPDATE marketplace_listings SET photo_url = ?, updated_at = datetime('now')
  WHERE id = ? AND seller_user_id = ?
`);
export const setListingPhoto = (id, sellerUserId, photoUrl) =>
  setListingPhotoStmt.run(photoUrl, id, sellerUserId);

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
  SELECT o.*, l.title, l.image_url,
    EXISTS(SELECT 1 FROM marketplace_reviews WHERE order_id = o.id AND role = 'buyer_to_seller') AS reviewed
  FROM marketplace_orders o
  JOIN marketplace_listings l ON l.id = o.listing_id
  WHERE o.buyer_user_id = ? ORDER BY o.created_at DESC
`);
export const listOrdersAsBuyer = (userId) => ordersAsBuyerStmt.all(userId);

const ordersAsSellerStmt = db.prepare(`
  SELECT o.*, l.title, l.image_url,
    EXISTS(SELECT 1 FROM marketplace_reviews WHERE order_id = o.id AND role = 'seller_to_buyer') AS reviewed
  FROM marketplace_orders o
  JOIN marketplace_listings l ON l.id = o.listing_id
  WHERE o.seller_user_id = ? ORDER BY o.created_at DESC
`);
export const listOrdersAsSeller = (userId) => ordersAsSellerStmt.all(userId);

// --- Bewertungen -------------------------------------------------------

const orderByIdStmt = db.prepare(`SELECT * FROM marketplace_orders WHERE id = ?`);
export const getOrderById = (id) => orderByIdStmt.get(id);

const insertReviewStmt = db.prepare(`
  INSERT INTO marketplace_reviews (order_id, reviewer_user_id, reviewee_user_id, role, rating, comment)
  VALUES (@order_id, @reviewer_user_id, @reviewee_user_id, @role, @rating, @comment)
`);
export const createReview = (values) => insertReviewStmt.run(values);

const sellerStatsStmt = db.prepare(`
  SELECT
    (SELECT ROUND(AVG(rating), 1) FROM marketplace_reviews WHERE reviewee_user_id = ?) AS rating,
    (SELECT COUNT(*) FROM marketplace_reviews WHERE reviewee_user_id = ?) AS review_count,
    (SELECT COUNT(*) FROM marketplace_orders WHERE seller_user_id = ? AND status IN ('paid','shipped','completed')) AS sales_count,
    u.display_name, u.id AS user_id
  FROM users u WHERE u.id = ?
`);
export const getSellerStats = (userId) => sellerStatsStmt.get(userId, userId, userId, userId);

// LEFT JOIN statt JOIN: Bewertungen überleben eine Kontolöschung des
// Bewertenden (kein Cascade-Delete auf marketplace_reviews) und zeigen dann
// "Gelöschter Nutzer" statt zu verschwinden - Vertrauenshistorie soll nicht
// rückwirkend verfälscht werden.
const reviewsForUserStmt = db.prepare(`
  SELECT r.*, COALESCE(u.display_name, 'Gelöschter Nutzer') AS reviewer_name
  FROM marketplace_reviews r
  LEFT JOIN users u ON u.id = r.reviewer_user_id
  WHERE r.reviewee_user_id = ?
  ORDER BY r.created_at DESC
  LIMIT 50
`);
export const listReviewsForUser = (userId) => reviewsForUserStmt.all(userId);

const sellerActiveListingsStmt = db.prepare(`
  SELECT * FROM marketplace_listings WHERE seller_user_id = ? AND status = 'active' ORDER BY created_at DESC
`);
export const listActiveListingsForSeller = (userId) => sellerActiveListingsStmt.all(userId);

// --- Kommentare / Fragen zu einem Angebot -------------------------------

const insertCommentStmt = db.prepare(`
  INSERT INTO marketplace_listing_comments (listing_id, user_id, body) VALUES (?, ?, ?)
`);
export const addListingComment = (listingId, userId, body) =>
  insertCommentStmt.run(listingId, userId, body);

const commentsForListingStmt = db.prepare(`
  SELECT c.*, COALESCE(u.display_name, 'Gelöschter Nutzer') AS author_name
  FROM marketplace_listing_comments c
  LEFT JOIN users u ON u.id = c.user_id
  WHERE c.listing_id = ?
  ORDER BY c.created_at ASC
`);
export const listCommentsForListing = (listingId) => commentsForListingStmt.all(listingId);

// --- Kontaktanfragen & manuell abgeschlossene Geschäfte (Stufe 1) ----------

const recentContactStmt = db.prepare(`
  SELECT 1 FROM marketplace_contacts
  WHERE listing_id = ? AND buyer_user_id = ? AND created_at > datetime('now', '-1 hour')
`);
export const hasRecentContact = (listingId, buyerUserId) => !!recentContactStmt.get(listingId, buyerUserId);

const insertContactStmt = db.prepare(`
  INSERT INTO marketplace_contacts (listing_id, buyer_user_id, message) VALUES (?, ?, ?)
`);
export const addContact = (listingId, buyerUserId, message) =>
  insertContactStmt.run(listingId, buyerUserId, message);

// Jede Person einmal (jüngste Anfrage), für die Auswahl "verkauft an ...".
const contactsForListingStmt = db.prepare(`
  SELECT c.buyer_user_id, COALESCE(u.display_name, u.email) AS name, MAX(c.created_at) AS created_at
  FROM marketplace_contacts c
  JOIN users u ON u.id = c.buyer_user_id
  WHERE c.listing_id = ?
  GROUP BY c.buyer_user_id
  ORDER BY created_at DESC
`);
export const listContactsForListing = (listingId) => contactsForListingStmt.all(listingId);

// Verkäufer meldet: "an diese Person verkauft". Legt eine abgeschlossene
// Bestellung ohne Stripe an (Provision 0), damit beide sich bewerten können
// und der Verkäufer seine Verkaufszahl bekommt.
const insertCompletedOrderStmt = db.prepare(`
  INSERT INTO marketplace_orders (listing_id, buyer_user_id, seller_user_id, amount_cents, fee_cents, currency, status)
  VALUES (?, ?, ?, ?, 0, ?, 'completed')
`);
export const createCompletedOrder = (listing, buyerUserId) =>
  insertCompletedOrderStmt.run(listing.id, buyerUserId, listing.seller_user_id, listing.price_cents, listing.currency);
