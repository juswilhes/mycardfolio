// Zahlungsabwicklung für den Marktplatz über Stripe Connect (Express-Konten).
// mycardfolio nimmt selbst nie Geld entgegen: Stripe zieht beim Kauf die
// komplette Summe auf unser Plattform-Konto ein und überweist sie
// automatisch abzüglich unserer Provision an das Express-Konto des
// Verkäufers ("destination charge") - Käuferschutz, KYC der Verkäufer und
// Auszahlung übernimmt Stripe, nicht wir.
//
// Ohne STRIPE_SECRET_KEY in der .env ist der Marktplatz absichtlich
// inaktiv (siehe isConfigured) statt mit kaputten Aufrufen zu crashen -
// die Einrichtung eines echten Stripe-Kontos ist ein eigener Schritt.
import Stripe from "stripe";

const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;

export const isConfigured = () => !!stripe;

// Provision von mycardfolio auf jeden Verkauf, in Prozent.
export const MARKETPLACE_FEE_PERCENT = Number(process.env.MARKETPLACE_FEE_PERCENT) || 8;

export const feeCentsFor = (priceCents) => Math.round(priceCents * (MARKETPLACE_FEE_PERCENT / 100));

function requireStripe() {
  if (!stripe) throw new Error("Stripe ist nicht konfiguriert (STRIPE_SECRET_KEY fehlt)");
  return stripe;
}

// Express-Konto für einen Verkäufer anlegen (einmalig - die ID wird in
// seller_accounts gespeichert und danach wiederverwendet).
export async function createConnectAccount(user) {
  const s = requireStripe();
  return s.accounts.create({
    type: "express",
    country: "DE",
    email: user.email,
    capabilities: { transfers: { requested: true } },
    business_type: "individual",
  });
}

// Onboarding-Link: Stripes eigenes, gehostetes Formular für Identität/
// Bankverbindung. Läuft nach kurzer Zeit ab, deshalb immer frisch erzeugen.
export async function createOnboardingLink(accountId, { refreshUrl, returnUrl }) {
  const s = requireStripe();
  const link = await s.accountLinks.create({
    account: accountId,
    refresh_url: refreshUrl,
    return_url: returnUrl,
    type: "account_onboarding",
  });
  return link.url;
}

export async function retrieveAccount(accountId) {
  const s = requireStripe();
  return s.accounts.retrieve(accountId);
}

// Checkout-Session für einen Kauf. Der Käufer bezahlt den vollen Preis an
// mycardfolio (Plattform-Konto); Stripe transferiert automatisch
// (price - Provision) an das Verkäufer-Konto, sobald die Zahlung durchgeht.
export async function createCheckoutSession({ listing, sellerAccountId, buyerEmail, successUrl, cancelUrl }) {
  const s = requireStripe();
  return s.checkout.sessions.create({
    mode: "payment",
    customer_email: buyerEmail || undefined,
    line_items: [
      {
        price_data: {
          currency: (listing.currency || "EUR").toLowerCase(),
          product_data: {
            name: listing.title,
            images: listing.image_url ? [listing.image_url] : undefined,
          },
          unit_amount: listing.price_cents,
        },
        quantity: 1,
      },
    ],
    payment_intent_data: {
      application_fee_amount: feeCentsFor(listing.price_cents),
      transfer_data: { destination: sellerAccountId },
    },
    shipping_address_collection: { allowed_countries: ["DE", "AT", "CH"] },
    metadata: { listing_id: String(listing.id) },
    success_url: successUrl,
    cancel_url: cancelUrl,
  });
}

export function constructWebhookEvent(rawBody, signature) {
  const s = requireStripe();
  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    throw new Error("STRIPE_WEBHOOK_SECRET fehlt");
  }
  return s.webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET);
}
