import { Router } from "express";
import { listSetsLocal, getSetLocal, getCardsBySetLocal } from "../services/cardRepository.js";

const router = Router();

// Alle drei Endpunkte lesen aus der lokalen DB (Import via `npm run import`).
// Dadurch lädt die "Alle Karten"-Seite sofort statt über die externe API.

// GET /api/sets -> alle Sets, für die "Alle Karten"-Übersichtsseite
router.get("/", (_req, res) => {
  res.json(listSetsLocal());
});

// GET /api/sets/:setId -> Metadaten zu einem Set (Name, Logo, Datum, ...)
router.get("/:setId", (req, res) => {
  const set = getSetLocal(req.params.setId);
  if (!set) return res.status(404).json({ error: "Set nicht gefunden" });
  res.json(set);
});

// GET /api/sets/:setId/cards -> alle Karten in diesem Set
router.get("/:setId/cards", (req, res) => {
  res.json(getCardsBySetLocal(req.params.setId));
});

export default router;
