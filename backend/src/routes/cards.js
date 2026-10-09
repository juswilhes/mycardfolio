import { Router } from "express";
import { getCardById } from "../services/pokemonTcgApi.js";
import {
  setArtistManual,
  priceHistoryByExternal,
  cardmarketBreakdownByExternal,
  cardMetaByExternalId,
  latestTrendByExternal,
} from "../services/cardService.js";
import {
  searchCardsLocal,
  getCardByExternalIdLocal,
  getCardsByArtistLocal,
  bumpCardView,
} from "../services/cardRepository.js";
import { cardmarketUrl } from "../services/priceProvider.js";
import { analysis } from "../services/analysisCache.js";
import { authRequired } from "../middleware/auth.js";
import { isOperatorUser } from "../lib/admin.js";

const router = Router();

// GET /api/cards/search?q=Pikachu  -> lokal, sofort
// Optional: &type=Level-Up (Kartenart, siehe /types) - dann reicht auch ein leeres q.
router.get("/search", (req, res) => {
  const q = String(req.query.q ?? "").trim();
  const type = req.query.type ? String(req.query.type) : null;
  if (!q && !type) return res.status(400).json({ error: "Query-Parameter 'q' fehlt" });
  res.json(searchCardsLocal(q, { type, limit: type ? 120 : 30 }));
});

// GET /api/cards/types -> [{ subtype, n }] alle Kartenarten (aus den Nacht-Auswertungen)
router.get("/types", (_req, res) => {
  res.json(analysis("cardTypes"));
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
    const breakdown = cardmarketBreakdownByExternal(externalId);
    const dbMeta = cardMetaByExternalId.get(externalId);
    return res.json({
      ...local,
      latest_price: latestTrendByExternal(externalId) ?? null,
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

// GET /api/cards/external/:externalId/prices -> Preisreihe (Tageswerte, EUR)
// für den Graphen; ihr letzter Punkt ist der "Aktuelle Preis".
router.get("/external/:externalId/prices", (req, res) => {
  res.json(priceHistoryByExternal(req.params.externalId));
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

export default router;
