import { Router } from "express";
import { getCardById } from "../services/pokemonTcgApi.js";
import {
  priceHistoryForCard,
  setArtistManual,
  priceHistoryByExternalId,
  cardmarketBreakdownByExternalId,
  cardMetaByExternalId,
  latestPriceByExternalId,
  upsertCardRow,
  recordPrices,
} from "../services/cardService.js";
import { searchCardsLocal, getCardByExternalIdLocal } from "../services/cardRepository.js";
import { getCardmarketPrices, cardmarketUrl } from "../services/priceProvider.js";

const router = Router();

// GET /api/cards/search?q=Pikachu  -> lokal, sofort
router.get("/search", (req, res) => {
  const q = req.query.q;
  if (!q) return res.status(400).json({ error: "Query-Parameter 'q' fehlt" });
  res.json(searchCardsLocal(q.trim()));
});

// GET /api/cards/external/:externalId -> Stammdaten (lokal) + aktuelle
// Cardmarket-Preise (EUR, via TCGdex, 6 h gecacht). Der Abruf ist schnell
// genug, um ihn hier zu awaiten; schlägt er fehl, kommen die zuletzt
// gespeicherten Werte zum Zug.
router.get("/external/:externalId", async (req, res) => {
  const { externalId } = req.params;
  const local = getCardByExternalIdLocal(externalId);

  if (local) {
    let meta = null;
    try {
      const { prices, meta: m } = await getCardmarketPrices(externalId);
      meta = m;
      if (prices.length) {
        const cardId = cardMetaByExternalId.get(externalId)?.id ?? upsertCardRow("pokemon", local);
        recordPrices(cardId, prices, m);
      }
    } catch {
      /* offline -> gespeicherte Werte unten */
    }
    const breakdown = cardmarketBreakdownByExternalId.all(externalId);
    const dbMeta = cardMetaByExternalId.get(externalId);
    return res.json({
      ...local,
      latest_price: latestPriceByExternalId.get(externalId) ?? null,
      price_breakdown: breakdown,
      cardmarket_updated: meta?.updated ?? dbMeta?.cardmarket_updated ?? null,
      cardmarket_url: cardmarketUrl(meta?.productId ?? dbMeta?.cardmarket_product_id ?? null),
    });
  }

  // Karte nicht im lokalen Datensatz -> live von pokemontcg.io
  try {
    const live = await getCardById(externalId, 8000);
    res.json({ ...live, price_breakdown: [], cardmarket_url: null });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// GET /api/cards/external/:externalId/prices -> Trend-Verlauf (EUR) für den Graphen
router.get("/external/:externalId/prices", (req, res) => {
  res.json(priceHistoryByExternalId.all(req.params.externalId));
});

// PATCH /api/cards/external/:externalId/artist  { artist }
router.patch("/external/:externalId/artist", (req, res) => {
  const artist = (req.body?.artist ?? "").trim();
  if (!artist) return res.status(400).json({ error: "artist fehlt" });
  const info = setArtistManual.run(artist, req.params.externalId);
  if (!info.changes) return res.status(404).json({ error: "Karte nicht gefunden" });
  res.json({ ok: true, artist });
});

// GET /api/cards/:id/prices  -> Trend-Verlauf (EUR), interne ID
router.get("/:id/prices", (req, res) => {
  res.json(priceHistoryForCard.all(req.params.id));
});

export default router;
