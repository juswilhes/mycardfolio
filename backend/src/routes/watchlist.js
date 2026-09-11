import { Router } from "express";
import { getCardById } from "../services/pokemonTcgApi.js";
import { upsertCardRow, recordPrices } from "../services/cardService.js";
import { getCardByExternalIdLocal } from "../services/cardRepository.js";
import { getCardmarketPrices, cardmarketUrl } from "../services/priceProvider.js";
import { addToWatchlist, removeFromWatchlist, listWatchlist, watchedExternalIds } from "../services/watchlistService.js";

const router = Router();

// GET /api/watchlist -> vollständige Liste inkl. aktuellem Preis
router.get("/", (req, res) => {
  res.json(
    listWatchlist(req.user.id).map((item) => ({
      ...item,
      cardmarket_url: cardmarketUrl(item.cardmarket_product_id),
    }))
  );
});

// GET /api/watchlist/ids -> nur externalIds, fürs Herzchen auf Suche/Set-Seiten
router.get("/ids", (req, res) => {
  res.json(watchedExternalIds(req.user.id));
});

// POST /api/watchlist { externalId }
router.post("/", async (req, res) => {
  const { externalId } = req.body ?? {};
  if (!externalId) return res.status(400).json({ error: "externalId fehlt" });

  let cardData = getCardByExternalIdLocal(externalId);
  if (!cardData) {
    try {
      cardData = await getCardById(externalId, 6000);
    } catch (err) {
      return res.status(502).json({ error: err.message });
    }
  }

  const cardId = upsertCardRow("pokemon", cardData);
  addToWatchlist(req.user.id, cardId);
  res.status(201).json({ ok: true });

  getCardmarketPrices(externalId)
    .then(({ prices, meta }) => {
      if (prices.length) recordPrices(cardId, prices, meta);
    })
    .catch(() => {});
});

// DELETE /api/watchlist/:externalId
router.delete("/:externalId", (req, res) => {
  const ok = removeFromWatchlist(req.user.id, req.params.externalId);
  if (!ok) return res.status(404).json({ error: "Nicht auf der Watchlist" });
  res.json({ ok: true });
});

export default router;
