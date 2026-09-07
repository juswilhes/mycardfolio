import { Router } from "express";
import { getSets, getSetById, getCardsBySet } from "../services/pokemonTcgApi.js";

const router = Router();

// GET /api/sets -> alle Sets, für die "Alle Karten"-Übersichtsseite
router.get("/", async (_req, res) => {
  try {
    res.json(await getSets());
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// GET /api/sets/:setId -> Metadaten zu einem Set (Name, Logo, Datum, ...)
router.get("/:setId", async (req, res) => {
  try {
    res.json(await getSetById(req.params.setId));
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// GET /api/sets/:setId/cards -> alle Karten in diesem Set
router.get("/:setId/cards", async (req, res) => {
  try {
    res.json(await getCardsBySet(req.params.setId));
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

export default router;
