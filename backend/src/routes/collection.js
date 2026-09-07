import { Router } from "express";
import db from "../db/index.js";
import { getCardById } from "../services/pokemonTcgApi.js";
import {
  upsertCardRow,
  recordPrices,
  listCollection,
  latestTrend,
  cardmarketBreakdown,
} from "../services/cardService.js";
import { getCardByExternalIdLocal } from "../services/cardRepository.js";
import { getCardmarketPrices, cardmarketUrl } from "../services/priceProvider.js";
import { recordPortfolioSnapshot, sellCollectionItem } from "../services/portfolioService.js";

const router = Router();

const insertCollectionItem = db.prepare(`
  INSERT INTO collection_items
    (card_id, quantity, condition, purchase_price, shipping_cost, purchase_date, notes, language, variant)
  VALUES
    (@card_id, @quantity, @condition, @purchase_price, @shipping_cost, @purchase_date, @notes, @language, @variant)
`);

const updateCollectionItem = db.prepare(`
  UPDATE collection_items SET
    quantity = @quantity, condition = @condition,
    purchase_price = @purchase_price, shipping_cost = @shipping_cost,
    purchase_date = @purchase_date, notes = @notes,
    language = COALESCE(@language, language),
    variant = COALESCE(@variant, variant)
  WHERE id = @id
`);

const deleteCollectionItem = db.prepare(`DELETE FROM collection_items WHERE id = ?`);

const num = (v) => {
  if (v === "" || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const langOrNull = (v) => (v === "de" || v === "en" ? v : null);
const VARIANTS = ["normal", "holo", "reverse", "first_edition"];
const variantOrNull = (v) => (VARIANTS.includes(v) ? v : null);

// Cardmarket-Preis im Hintergrund nachziehen (blockiert die Antwort nie).
function refreshPriceInBackground(cardId, externalId) {
  getCardmarketPrices(externalId)
    .then(({ prices, meta }) => {
      if (prices.length) recordPrices(cardId, prices, meta);
    })
    .catch(() => {});
}

// GET /api/collection -> Sammlung inkl. aktuellem Cardmarket-Preis (EUR)
router.get("/", (_req, res) => {
  const items = listCollection.all().map((item) => ({
    ...item,
    latest_price: latestTrend(item.card_id, item.variant || "normal"),
    price_breakdown: cardmarketBreakdown(item.card_id),
    cardmarket_url: cardmarketUrl(item.cardmarket_product_id),
  }));
  res.json(items);
});

// POST /api/collection
// { externalId, quantity, condition, purchasePrice, shippingCost, purchaseDate, notes, language }
router.post("/", async (req, res) => {
  const {
    externalId,
    quantity = 1,
    condition = "near_mint",
    purchasePrice,
    shippingCost,
    purchaseDate,
    notes,
    language,
    variant,
  } = req.body;
  if (!externalId) return res.status(400).json({ error: "externalId fehlt" });

  // Kartendaten aus der lokalen DB -> sofort. Fehlt die Karte lokal, einmal live nachladen.
  let cardData = getCardByExternalIdLocal(externalId);
  if (!cardData) {
    try {
      cardData = await getCardById(externalId, 6000);
    } catch (err) {
      return res.status(502).json({ error: err.message });
    }
  }

  let cardId;
  try {
    cardId = upsertCardRow("pokemon", cardData);
    insertCollectionItem.run({
      card_id: cardId,
      quantity: num(quantity) ?? 1,
      condition: condition || "near_mint",
      purchase_price: num(purchasePrice),
      shipping_cost: num(shippingCost),
      purchase_date: purchaseDate || null,
      notes: notes || null,
      language: langOrNull(language) ?? "en",
      variant: variantOrNull(variant) ?? "normal",
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }

  res.status(201).json({ cardId });
  refreshPriceInBackground(cardId, externalId);
  recordPortfolioSnapshot();
});

// PATCH /api/collection/:id
router.patch("/:id", (req, res) => {
  const { quantity, condition, purchasePrice, shippingCost, purchaseDate, notes, language, variant } =
    req.body;
  const info = updateCollectionItem.run({
    id: Number(req.params.id),
    quantity: num(quantity) ?? 1,
    condition: condition || "near_mint",
    purchase_price: num(purchasePrice),
    shipping_cost: num(shippingCost),
    purchase_date: purchaseDate || null,
    notes: notes || null,
    language: langOrNull(language),
    variant: variantOrNull(variant),
  });
  if (!info.changes) return res.status(404).json({ error: "Eintrag nicht gefunden" });
  recordPortfolioSnapshot();
  res.json({ ok: true });
});

// POST /api/collection/:id/sell
// { salePrice, saleShipping, saleFees, soldOn, notes } -> in die Verkaufshistorie
router.post("/:id/sell", (req, res) => {
  const { salePrice, saleShipping, saleFees, soldOn, notes } = req.body;
  const ok = sellCollectionItem(req.params.id, {
    salePrice: num(salePrice),
    saleShipping: num(saleShipping),
    saleFees: num(saleFees),
    soldOn: soldOn || new Date().toISOString().slice(0, 10),
    notes: notes || null,
  });
  if (!ok) return res.status(404).json({ error: "Eintrag nicht gefunden" });
  recordPortfolioSnapshot();
  res.json({ ok: true });
});

// DELETE /api/collection/:id -> Karte ohne Verkauf aus der Sammlung entfernen
router.delete("/:id", (req, res) => {
  const info = deleteCollectionItem.run(Number(req.params.id));
  if (!info.changes) return res.status(404).json({ error: "Eintrag nicht gefunden" });
  recordPortfolioSnapshot();
  res.json({ ok: true });
});

export default router;
