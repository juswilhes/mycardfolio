import { Router } from "express";
import db from "../db/index.js";
import { getCardById } from "../services/pokemonTcgApi.js";
import { saveCardWithPrices, listCollection, latestPriceForCard } from "../services/cardService.js";

const router = Router();

const insertCollectionItem = db.prepare(`
  INSERT INTO collection_items (card_id, quantity, condition, purchase_price, purchase_date, notes)
  VALUES (?, ?, ?, ?, ?, ?)
`);

// GET /api/collection -> Sammlung inkl. aktuellem Preis pro Karte
router.get("/", (_req, res) => {
  const items = listCollection.all().map((item) => ({
    ...item,
    latest_price: latestPriceForCard.get(item.card_id) ?? null,
  }));
  res.json(items);
});

// POST /api/collection { externalId, quantity, condition, purchasePrice, purchaseDate, notes }
// Legt die Karte (falls neu) an, zieht sofort den aktuellen Preis und fügt sie der Sammlung hinzu.
router.post("/", async (req, res) => {
  const { externalId, quantity = 1, condition = "near_mint", purchasePrice, purchaseDate, notes } = req.body;
  if (!externalId) return res.status(400).json({ error: "externalId fehlt" });

  try {
    const cardData = await getCardById(externalId);
    const cardId = saveCardWithPrices("pokemon", cardData);
    insertCollectionItem.run(cardId, quantity, condition, purchasePrice ?? null, purchaseDate ?? null, notes ?? null);
    res.status(201).json({ cardId });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

export default router;
