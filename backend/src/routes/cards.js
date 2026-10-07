import { Router } from "express";
import { getCardById } from "../services/pokemonTcgApi.js";
import {
  priceHistoryForCardAllVariants,
  setArtistManual,
  priceHistoryByExternalId,
  cardmarketBreakdownByExternalId,
  cardMetaByExternalId,
  latestPriceByExternalId,
} from "../services/cardService.js";
import {
  searchCardsLocal,
  getCardByExternalIdLocal,
  getCardsByArtistLocal,
  bumpCardView,
} from "../services/cardRepository.js";
import { cardmarketUrl } from "../services/priceProvider.js";
import { authRequired } from "../middleware/auth.js";
import { isOperatorUser } from "../lib/admin.js";

const router = Router();

// GET /api/cards/search?q=Pikachu  -> lokal, sofort
router.get("/search", (req, res) => {
  const q = req.query.q;
  if (!q) return res.status(400).json({ error: "Query-Parameter 'q' fehlt" });
  res.json(searchCardsLocal(q.trim()));
});

// GET /api/cards/by-artist?name=Ken%20Sugimori -> alle Karten dieses
// Illustrators (öffentlich, wie die Suche)
router.get("/by-artist", (req, res) => {
  const name = (req.query.name ?? "").trim();
  if (!name) return res.status(400).json({ error: "Query-Parameter 'name' fehlt" });
  res.json(getCardsByArtistLocal(name));
});

// GET /api/cards/external/:externalId -> Stammdaten (lokal) + gespeicherte
// Cardmarket-Preise (EUR). Preise werden NICHT beim Öffnen der Seite
// abgefragt, sondern nur einmal täglich um 1 Uhr (services/priceFetcher.js) -
// ein Abruf bei TCGdex pro Seitenaufruf machte die Seiten langsam.
router.get("/external/:externalId", async (req, res) => {
  const { externalId } = req.params;
  const local = getCardByExternalIdLocal(externalId);
  bumpCardView(externalId); // "Beliebtheit" in der Set-Übersicht

  if (local) {
    const breakdown = cardmarketBreakdownByExternalId.all(externalId);
    const dbMeta = cardMetaByExternalId.get(externalId);
    return res.json({
      ...local,
      latest_price: latestPriceByExternalId.get(externalId) ?? null,
      price_breakdown: breakdown,
      cardmarket_updated: dbMeta?.cardmarket_updated ?? null,
      cardmarket_url: cardmarketUrl(dbMeta?.cardmarket_product_id ?? null),
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
// Nur der Betreiber darf das ändern - sonst könnte jeder angemeldete
// Nutzer Kartenstammdaten verfälschen (die Suche selbst bleibt öffentlich).
router.patch("/external/:externalId/artist", authRequired, (req, res) => {
  if (!isOperatorUser(req.user)) return res.status(403).json({ error: "Nur der Betreiber darf das ändern." });
  const artist = (req.body?.artist ?? "").trim();
  if (!artist) return res.status(400).json({ error: "artist fehlt" });
  const info = setArtistManual.run(artist, req.params.externalId);
  if (!info.changes) return res.status(404).json({ error: "Karte nicht gefunden" });
  res.json({ ok: true, artist });
});

// GET /api/cards/:id/prices  -> Trend-Verlauf (EUR) inkl. Holo/Reverse,
// interne ID - für die Kartenseite in der Sammlung, dieselbe Ansicht wie
// in der Kartensuche (siehe /external/:externalId/prices).
router.get("/:id/prices", (req, res) => {
  res.json(priceHistoryForCardAllVariants.all(req.params.id));
});

export default router;
