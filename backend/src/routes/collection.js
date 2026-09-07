import { Router } from "express";
import db from "../db/index.js";
import { getCardById } from "../services/pokemonTcgApi.js";
import { saveCardWithPrices, listCollection, latestPriceForCard } from "../services/cardService.js";
import { getCardByExternalIdLocal } from "../services/cardRepository.js";

const router = Router();

const insertCollectionItem = db.prepare(`
  INSERT INTO collection_items
    (card_id, quantity, condition, purchase_price, shipping_cost, purchase_date, notes)
  VALUES
    (@card_id, @quantity, @condition, @purchase_price, @shipping_cost, @purchase_date, @notes)
`);

const updateCollectionItem = db.prepare(`
  UPDATE collection_items SET
    quantity = @quantity, condition = @condition,
    purchase_price = @purchase_price, shipping_cost = @shipping_cost,
    purchase_date = @purchase_date, notes = @notes
  WHERE id = @id
`);

const deleteCollectionItem = db.prepare(`DELETE FROM collection_items WHERE id = ?`);

const num = (v) => {
  if (v === "" || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

// GET /api/collection -> Sammlung inkl. aktuellem Preis pro Karte
router.get("/", (_req, res) => {
  const items = listCollection.all().map((item) => ({
    ...item,
    latest_price: latestPriceForCard.get(item.card_id) ?? null,
  }));
  res.json(items);
});

// POST /api/collection
// { externalId, quantity, condition, purchasePrice, shippingCost, purchaseDate, notes }
// Legt die Karte (falls neu) an, zieht sofort den aktuellen Preis und fügt sie der Sammlung hinzu.
router.post("/", async (req, res) => {
  const {
    externalId,
    quantity = 1,
    condition = "near_mint",
    purchasePrice,
    shippingCost,
    purchaseDate,
    notes,
  } = req.body;
  if (!externalId) return res.status(400).json({ error: "externalId fehlt" });

  // Kartendaten kommen aus der lokalen DB -> sofort. Fehlt die Karte lokal,
  // einmal live nachladen.
  const local = getCardByExternalIdLocal(externalId);
  let cardData = local;
  if (!cardData) {
    try {
      cardData = await getCardById(externalId, 6000);
    } catch (err) {
      return res.status(502).json({ error: err.message });
    }
  }

  let cardId;
  try {
    cardId = saveCardWithPrices("pokemon", { ...cardData, prices: cardData.prices ?? [] });
    insertCollectionItem.run({
      card_id: cardId,
      quantity: num(quantity) ?? 1,
      condition: condition || "near_mint",
      purchase_price: num(purchasePrice),
      shipping_cost: num(shippingCost),
      purchase_date: purchaseDate || null,
      notes: notes || null,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }

  // sofort antworten - die Animation im Frontend soll nicht auf die
  // langsame Preis-API warten
  res.status(201).json({ cardId });

  // aktuellen Preis best-effort im Hintergrund nachziehen
  if (local) {
    getCardById(externalId, 8000)
      .then((live) => {
        if (live.prices?.length) saveCardWithPrices("pokemon", { ...live, prices: live.prices });
      })
      .catch(() => {});
  }
});

// PATCH /api/collection/:id  { quantity, condition, purchasePrice, shippingCost, purchaseDate, notes }
router.patch("/:id", (req, res) => {
  const { quantity, condition, purchasePrice, shippingCost, purchaseDate, notes } = req.body;
  const info = updateCollectionItem.run({
    id: Number(req.params.id),
    quantity: num(quantity) ?? 1,
    condition: condition || "near_mint",
    purchase_price: num(purchasePrice),
    shipping_cost: num(shippingCost),
    purchase_date: purchaseDate || null,
    notes: notes || null,
  });
  if (!info.changes) return res.status(404).json({ error: "Eintrag nicht gefunden" });
  res.json({ ok: true });
});

// DELETE /api/collection/:id -> Karte aus der Sammlung entfernen
router.delete("/:id", (req, res) => {
  const info = deleteCollectionItem.run(Number(req.params.id));
  if (!info.changes) return res.status(404).json({ error: "Eintrag nicht gefunden" });
  res.json({ ok: true });
});

export default router;
