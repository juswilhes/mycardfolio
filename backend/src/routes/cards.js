import { Router } from "express";
import { getCardById } from "../services/pokemonTcgApi.js";
import { priceHistoryForCard, latestPriceForCard, cardIdByExternalId } from "../services/cardService.js";
import { searchCardsLocal, getCardByExternalIdLocal } from "../services/cardRepository.js";

const router = Router();

// GET /api/cards/search?q=Pikachu
// Läuft komplett gegen die lokale DB -> sofortige Ergebnisse, keine
// Wartezeit durch externe API-Aufrufe.
router.get("/search", (req, res) => {
  const q = req.query.q;
  if (!q) return res.status(400).json({ error: "Query-Parameter 'q' fehlt" });
  res.json(searchCardsLocal(q.trim()));
});

// GET /api/cards/external/:externalId -> alle bekannten Infos zu EINER Karte.
// Stammdaten (Illustrator, Attacken, Schwächen, ...) kommen aus der lokalen
// DB und sind sofort da. Preise: zuletzt gespeicherter Snapshot; ein
// frischer Live-Abruf wird nur angestoßen, wenn die Karte lokal fehlt.
router.get("/external/:externalId", async (req, res) => {
  const { externalId } = req.params;
  const local = getCardByExternalIdLocal(externalId);

  if (local) {
    const cardId = cardIdByExternalId.get(externalId)?.id;
    const last = cardId ? latestPriceForCard.get(cardId) : null;
    return res.json({ ...local, prices: last ? [last] : [] });
  }

  // Karte (noch) nicht im lokalen Datensatz -> live versuchen (mit Timeout)
  try {
    const live = await getCardById(externalId, 8000);
    res.json({ ...live, prices: live.prices ?? [] });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// GET /api/cards/:id/prices  -> Datenpunkte für den Graphen
router.get("/:id/prices", (req, res) => {
  const rows = priceHistoryForCard.all(req.params.id);
  res.json(rows);
});

export default router;
