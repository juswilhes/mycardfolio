import { Router } from "express";
import { authRequired } from "../middleware/auth.js";
import {
  isConfigured,
  MARKETPLACE_FEE_PERCENT,
  feeCentsFor,
  createConnectAccount,
  createOnboardingLink,
  retrieveAccount,
  createCheckoutSession,
} from "../services/stripeConnect.js";
import {
  getSellerAccount,
  saveSellerAccount,
  setOnboardingComplete,
  createListingFromCollectionItem,
  createListingFromSealedProduct,
  getListingById,
  getListingWithSeller,
  setListingPhoto,
  listActiveListings,
  listMyListings,
  cancelListing,
  createPendingOrder,
  markOrderShipped,
  listOrdersAsBuyer,
  listOrdersAsSeller,
  getOrderById,
  createReview,
  getSellerStats,
  listReviewsForUser,
  listActiveListingsForSeller,
  addListingComment,
  listCommentsForListing,
} from "../services/marketplaceService.js";
import { watchersForExternalId } from "../services/watchlistService.js";
import { sendWishlistMatchMail, sendListingCommentMail } from "../services/mailer.js";
import { uploadListingPhoto, listingPhotoUrl } from "../lib/uploads.js";
import { findUserById } from "../services/authService.js";

const router = Router();
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";
const eur = (cents) => `${(cents / 100).toFixed(2).replace(".", ",")} €`;

// Ab diesem Preis ist ein eigenes Foto des echten Exemplars Pflicht statt
// nur empfohlen - je teurer die Karte, desto wichtiger Beleg statt Stockbild.
const PHOTO_REQUIRED_EUR = Number(process.env.MARKETPLACE_PHOTO_REQUIRED_EUR) || 10;
const PHOTO_REQUIRED_CENTS = Math.round(PHOTO_REQUIRED_EUR * 100);

// Solange kein STRIPE_SECRET_KEY hinterlegt ist, ist der Marktplatz bewusst
// inaktiv statt mit kaputten Aufrufen zu crashen - das Anlegen des echten
// Stripe-Kontos ist ein eigener, von uns nicht ausführbarer Schritt.
router.use((req, res, next) => {
  if (!isConfigured()) {
    return res.status(503).json({
      error: "Der Marktplatz ist noch nicht eingerichtet (Zahlungsdienst fehlt).",
    });
  }
  next();
});

// GET /api/marketplace/config -> öffentliche Eckdaten (Provision, ab wann ein Foto Pflicht ist)
router.get("/config", (req, res) => {
  res.json({ feePercent: MARKETPLACE_FEE_PERCENT, photoRequiredFromEur: PHOTO_REQUIRED_EUR });
});

// GET /api/marketplace/listings -> alle aktiven Angebote (öffentlich)
router.get("/listings", (req, res) => {
  res.json(listActiveListings());
});

// GET /api/marketplace/seller/status -> eigener Verkäuferkonto-Status
router.get("/seller/status", authRequired, async (req, res) => {
  const account = getSellerAccount(req.user.id);
  res.json({
    hasAccount: !!account,
    onboardingComplete: !!account?.onboarding_complete,
  });
});

// POST /api/marketplace/seller/onboard -> Stripe-Konto anlegen (falls nötig)
// + frischen Onboarding-Link zurückgeben, zu dem das Frontend weiterleitet.
router.post("/seller/onboard", authRequired, async (req, res) => {
  try {
    let account = getSellerAccount(req.user.id);
    if (!account) {
      const stripeAccount = await createConnectAccount(req.user);
      saveSellerAccount(req.user.id, stripeAccount.id);
      account = getSellerAccount(req.user.id);
    }
    const url = await createOnboardingLink(account.stripe_account_id, {
      refreshUrl: `${FRONTEND_URL}/konto?stripe=refresh`,
      returnUrl: `${FRONTEND_URL}/konto?stripe=return`,
    });
    res.json({ url });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// GET /api/marketplace/seller/refresh -> Onboarding-Status bei Stripe
// nachschlagen (nach Rückkehr vom Onboarding-Formular aufgerufen).
router.get("/seller/refresh", authRequired, async (req, res) => {
  const account = getSellerAccount(req.user.id);
  if (!account) return res.json({ hasAccount: false, onboardingComplete: false });
  try {
    const stripeAccount = await retrieveAccount(account.stripe_account_id);
    const complete = !!stripeAccount.details_submitted && !!stripeAccount.charges_enabled;
    setOnboardingComplete(req.user.id, complete);
    res.json({ hasAccount: true, onboardingComplete: complete });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// POST /api/marketplace/listings  (multipart) - Felder kind, collectionItemId |
// sealedProductId, priceEur, description, optional Datei "photo". Läuft
// bewusst als EIN Request statt "erst Angebot, dann Foto nachreichen" -
// sonst gäbe es einen Zwischenzustand "Angebot ab 10 € ohne Pflichtfoto".
router.post("/listings", authRequired, (req, res) => {
  uploadListingPhoto(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: "Foto konnte nicht hochgeladen werden (max. 8 MB, JPG/PNG/WebP)." });
    }

    const account = getSellerAccount(req.user.id);
    if (!account?.onboarding_complete) {
      return res.status(403).json({ error: "Bitte zuerst dein Verkäuferkonto einrichten." });
    }
    const { kind, collectionItemId, sealedProductId, priceEur, description } = req.body;
    const priceCents = Math.round(Number(priceEur) * 100);
    if (!priceCents || priceCents < 50) {
      return res.status(400).json({ error: "Bitte einen gültigen Preis (mind. 0,50 €) angeben." });
    }
    if (priceCents >= PHOTO_REQUIRED_CENTS && !req.file) {
      return res.status(400).json({
        error: `Ab ${PHOTO_REQUIRED_EUR} € ist ein eigenes Foto des Exemplars Pflicht (für mehr Transparenz beim Kauf).`,
      });
    }

    let id = null;
    if (kind === "card" && collectionItemId) {
      id = createListingFromCollectionItem(req.user.id, Number(collectionItemId), {
        priceCents,
        description,
      });
    } else if (kind === "sealed" && sealedProductId) {
      id = createListingFromSealedProduct(req.user.id, Number(sealedProductId), {
        priceCents,
        description,
      });
    } else {
      return res.status(400).json({ error: "kind/collectionItemId/sealedProductId fehlt" });
    }

    if (!id) return res.status(404).json({ error: "Karte/Produkt nicht gefunden" });
    if (req.file) setListingPhoto(id, req.user.id, listingPhotoUrl(req.file.filename));
    res.status(201).json({ id });

    // Community-Feature: alle, die genau diese Karte auf der Watchlist haben,
    // bekommen eine Mail, statt selbst immer wieder nachschauen zu müssen.
    const listing = getListingById(id);
    if (listing?.external_id) {
      for (const watcher of watchersForExternalId(listing.external_id)) {
        if (watcher.user_id === req.user.id) continue;
        sendWishlistMatchMail(watcher.email, {
          cardName: listing.title,
          price: eur(listing.price_cents),
          listingUrl: `${FRONTEND_URL}/marktplatz/angebot/${listing.id}`,
        }).catch(() => {});
      }
    }
  });
});

// POST /api/marketplace/listings/:id/photo  (multipart, Feld "photo")
// Echtes Foto des Exemplars statt nur des generischen Kartenbilds - für
// Vertrauen/Echtheit besonders bei teureren Karten wichtig.
router.post("/listings/:id/photo", authRequired, (req, res) => {
  uploadListingPhoto(req, res, (err) => {
    if (err) return res.status(400).json({ error: "Foto konnte nicht hochgeladen werden (max. 8 MB, JPG/PNG/WebP)." });
    if (!req.file) return res.status(400).json({ error: "Keine Datei erhalten." });
    const info = setListingPhoto(Number(req.params.id), req.user.id, listingPhotoUrl(req.file.filename));
    if (!info.changes) return res.status(404).json({ error: "Angebot nicht gefunden" });
    res.json({ photoUrl: listingPhotoUrl(req.file.filename) });
  });
});

// GET /api/marketplace/listings/:id -> Detailseite (öffentlich): Angebot +
// Verkäufer-Bewertungsschnitt + Fragen/Kommentare.
router.get("/listings/:id", (req, res) => {
  const listing = getListingWithSeller(Number(req.params.id));
  if (!listing) return res.status(404).json({ error: "Angebot nicht gefunden" });
  res.json({ ...listing, comments: listCommentsForListing(listing.id) });
});

// POST /api/marketplace/listings/:id/comments  { body } -> Frage/Kommentar
router.post("/listings/:id/comments", authRequired, (req, res) => {
  const body = (req.body?.body ?? "").trim().slice(0, 1000);
  if (!body) return res.status(400).json({ error: "Text fehlt" });
  const listing = getListingById(Number(req.params.id));
  if (!listing) return res.status(404).json({ error: "Angebot nicht gefunden" });

  addListingComment(listing.id, req.user.id, body);
  res.status(201).json({ ok: true });

  if (listing.seller_user_id !== req.user.id) {
    const seller = findUserById(listing.seller_user_id);
    if (seller) {
      sendListingCommentMail(seller.email, {
        listingTitle: listing.title,
        listingUrl: `${FRONTEND_URL}/marktplatz/angebot/${listing.id}`,
        authorName: req.user.display_name || req.user.email,
      }).catch(() => {});
    }
  }
});

// GET /api/marketplace/sellers/:userId -> öffentliches Verkäuferprofil
router.get("/sellers/:userId", (req, res) => {
  const userId = Number(req.params.userId);
  const stats = getSellerStats(userId);
  if (!stats?.user_id) return res.status(404).json({ error: "Nutzer nicht gefunden" });
  res.json({
    ...stats,
    reviews: listReviewsForUser(userId),
    listings: listActiveListingsForSeller(userId),
  });
});

// GET /api/marketplace/listings/mine -> eigene Angebote (alle Status)
router.get("/listings/mine", authRequired, (req, res) => {
  res.json(listMyListings(req.user.id));
});

// DELETE /api/marketplace/listings/:id -> eigenes aktives Angebot zurückziehen
router.delete("/listings/:id", authRequired, (req, res) => {
  const info = cancelListing(req.user.id, Number(req.params.id));
  if (!info.changes) return res.status(404).json({ error: "Angebot nicht gefunden" });
  res.json({ ok: true });
});

// POST /api/marketplace/listings/:id/checkout -> Stripe-Checkout-Session
// für einen Kauf, Frontend leitet zur zurückgegebenen URL weiter.
router.post("/listings/:id/checkout", authRequired, async (req, res) => {
  const listing = getListingById(Number(req.params.id));
  if (!listing || listing.status !== "active") {
    return res.status(404).json({ error: "Angebot nicht (mehr) verfügbar" });
  }
  if (listing.seller_user_id === req.user.id) {
    return res.status(400).json({ error: "Du kannst dein eigenes Angebot nicht kaufen." });
  }
  const sellerAccount = getSellerAccount(listing.seller_user_id);
  if (!sellerAccount?.onboarding_complete) {
    return res.status(409).json({ error: "Verkäufer ist gerade nicht zahlungsbereit." });
  }

  try {
    const session = await createCheckoutSession({
      listing,
      sellerAccountId: sellerAccount.stripe_account_id,
      buyerEmail: req.user.email,
      successUrl: `${FRONTEND_URL}/marktplatz?kauf=erfolgreich&angebot=${listing.id}`,
      cancelUrl: `${FRONTEND_URL}/marktplatz`,
    });
    createPendingOrder({
      listing_id: listing.id,
      buyer_user_id: req.user.id,
      seller_user_id: listing.seller_user_id,
      stripe_checkout_session_id: session.id,
      amount_cents: listing.price_cents,
      fee_cents: feeCentsFor(listing.price_cents),
      currency: listing.currency,
    });
    res.json({ url: session.url });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// GET /api/marketplace/orders -> eigene Käufe + Verkäufe
router.get("/orders", authRequired, (req, res) => {
  res.json({
    purchases: listOrdersAsBuyer(req.user.id),
    sales: listOrdersAsSeller(req.user.id),
  });
});

// POST /api/marketplace/orders/:id/ship  { trackingCode }
router.post("/orders/:id/ship", authRequired, (req, res) => {
  const info = markOrderShipped(Number(req.params.id), req.user.id, req.body?.trackingCode || null);
  if (!info.changes) return res.status(404).json({ error: "Bestellung nicht gefunden" });
  res.json({ ok: true });
});

// POST /api/marketplace/orders/:id/review  { rating, comment } -> beidseitig:
// Käufer bewertet Verkäufer ODER Verkäufer bewertet Käufer, je nachdem wer
// aufruft. Erst ab "paid" möglich (Zahlung ist durch), pro Bestellung und
// Richtung nur einmal (UNIQUE-Constraint in der DB).
router.post("/orders/:id/review", authRequired, (req, res) => {
  const order = getOrderById(Number(req.params.id));
  if (!order) return res.status(404).json({ error: "Bestellung nicht gefunden" });
  if (!["paid", "shipped", "completed"].includes(order.status)) {
    return res.status(409).json({ error: "Diese Bestellung ist noch nicht bezahlt." });
  }

  let role, revieweeId;
  if (order.buyer_user_id === req.user.id) {
    role = "buyer_to_seller";
    revieweeId = order.seller_user_id;
  } else if (order.seller_user_id === req.user.id) {
    role = "seller_to_buyer";
    revieweeId = order.buyer_user_id;
  } else {
    return res.status(403).json({ error: "Das ist nicht deine Bestellung." });
  }

  const rating = Math.round(Number(req.body?.rating));
  if (!(rating >= 1 && rating <= 5)) {
    return res.status(400).json({ error: "Bewertung muss zwischen 1 und 5 liegen." });
  }

  try {
    createReview({
      order_id: order.id,
      reviewer_user_id: req.user.id,
      reviewee_user_id: revieweeId,
      role,
      rating,
      comment: (req.body?.comment ?? "").trim().slice(0, 1000) || null,
    });
    res.status(201).json({ ok: true });
  } catch (err) {
    if (String(err.message).includes("UNIQUE")) {
      return res.status(409).json({ error: "Du hast diese Bestellung schon bewertet." });
    }
    res.status(500).json({ error: err.message });
  }
});

export default router;
