import { Router } from "express";
import { searchCards, getCardById } from "../services/pokemonTcgApi.js";
import { priceHistoryForCard } from "../services/cardService.js";

const router = Router();

// GET /api/cards/search?q=Pikachu
router.get("/search", async (req, res) => {
  const q = req.query.q;
  if (!q) return res.status(400).json({ error: "Query-Parameter 'q' fehlt" });
  try {
    const results = await searchCards(q);
    res.json(results);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// GET /api/cards/external/:externalId -> Live-Kartendaten inkl. aktueller Preise,
// direkt von der Pokemon-TCG-API. Funktioniert für JEDE Karte, auch wenn sie
// noch nicht in der eigenen Sammlung/Datenbank gespeichert ist - das ist der
// Unterschied zur Detailseite in der Sammlung, die die lokale Preishistorie zeigt.
router.get("/external/:externalId", async (req, res) => {
  try {
    res.json(await getCardById(req.params.externalId));
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
