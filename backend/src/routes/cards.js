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
import { searchCardsLocal, getCardByExternalIdLocal, bumpCardView } from "../services/cardRepository.js";
import { getCardmarketPrices, cardmarketUrl } from "../services/priceProvider.js";
import { authRequired } from "../middleware/auth.js";

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
  bumpCardView(externalId); // "Beliebtheit" in der Set-Übersicht

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

// Mindestabstand zwischen erzwungenen Aktualisierungen derselben Karte,
// damit der Button nicht zum Spam gegen TCGdex einlädt.
const FORCE_REFRESH_COOLDOWN_MS = 60 * 1000;
const lastForceRefresh = new Map();

// POST /api/cards/external/:externalId/refresh -> erzwingt eine frische
// Abfrage bei TCGdex (umgeht den 6h-Cache), angemeldet wegen der externen
// Anfrage, die das auslöst.
router.post("/external/:externalId/refresh", authRequired, async (req, res) => {
  const { externalId } = req.params;
  const local = getCardByExternalIdLocal(externalId);
  if (!local) return res.status(404).json({ error: "Karte nicht gefunden" });

  const last = lastForceRefresh.get(externalId) ?? 0;
  if (Date.now() - last < FORCE_REFRESH_COOLDOWN_MS) {
    return res.status(429).json({ error: "Bitte kurz warten, bevor du erneut aktualisierst." });
  }
  lastForceRefresh.set(externalId, Date.now());

  try {
    const { prices, meta } = await getCardmarketPrices(externalId, { force: true });
    if (prices.length) {
      const cardId = cardMetaByExternalId.get(externalId)?.id ?? upsertCardRow("pokemon", local);
      recordPrices(cardId, prices, meta);
    }
    res.json({
      ok: true,
      updated: meta?.updated ?? null,
      latest_price: latestPriceByExternalId.get(externalId) ?? null,
    });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// PATCH /api/cards/external/:externalId/artist  { artist }
// Angemeldet, damit nicht anonym Kartendaten verändert werden können
// (die Suche selbst bleibt öffentlich).
router.patch("/external/:externalId/artist", authRequired, (req, res) => {
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
