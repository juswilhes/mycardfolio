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
  listActiveListings,
  listMyListings,
  cancelListing,
  createPendingOrder,
  markOrderShipped,
  listOrdersAsBuyer,
  listOrdersAsSeller,
} from "../services/marketplaceService.js";

const router = Router();
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

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

// GET /api/marketplace/config -> öffentliche Eckdaten (Provision)
router.get("/config", (req, res) => {
  res.json({ feePercent: MARKETPLACE_FEE_PERCENT });
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

// POST /api/marketplace/listings  { kind, collectionItemId | sealedProductId, priceEur, description }
router.post("/listings", authRequired, (req, res) => {
  const account = getSellerAccount(req.user.id);
  if (!account?.onboarding_complete) {
    return res.status(403).json({ error: "Bitte zuerst dein Verkäuferkonto einrichten." });
  }
  const { kind, collectionItemId, sealedProductId, priceEur, description } = req.body;
  const priceCents = Math.round(Number(priceEur) * 100);
  if (!priceCents || priceCents < 50) {
    return res.status(400).json({ error: "Bitte einen gültigen Preis (mind. 0,50 €) angeben." });
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
  res.status(201).json({ id });
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
      successUrl: `${FRONTEND_URL}/marktplatz?kauf=erfolgreich`,
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

export default router;
