// Stripe-Webhook: braucht den unveränderten Rohkörper zur Signaturprüfung,
// deshalb ein eigener Handler, den server.js VOR express.json() einhängt.
import { constructWebhookEvent } from "../services/stripeConnect.js";
import {
  getOrderBySessionId,
  markOrderPaid,
  markListingSold,
  getSellerAccountByStripeId,
  setOnboardingComplete,
} from "../services/marketplaceService.js";

export async function handleStripeWebhook(req, res) {
  let event;
  try {
    event = constructWebhookEvent(req.body, req.headers["stripe-signature"]);
  } catch (err) {
    return res.status(400).send(`Webhook-Signatur ungültig: ${err.message}`);
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const order = getOrderBySessionId(session.id);
      if (order) {
        markOrderPaid({
          session_id: session.id,
          payment_intent_id: session.payment_intent ?? null,
          shipping_name: session.shipping_details?.name ?? session.customer_details?.name ?? null,
          shipping_address: session.shipping_details?.address
            ? JSON.stringify(session.shipping_details.address)
            : null,
        });
        markListingSold(order.listing_id);
      }
    } else if (event.type === "account.updated") {
      const account = event.data.object;
      const seller = getSellerAccountByStripeId(account.id);
      if (seller) {
        setOnboardingComplete(seller.user_id, !!account.details_submitted && !!account.charges_enabled);
      }
    }
  } catch (err) {
    console.error("[stripe webhook]", err);
  }

  res.json({ received: true });
}
