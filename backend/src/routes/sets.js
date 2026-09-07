import { Router } from "express";
import { listSetsLocal, getSetLocal, getCardsBySetLocal } from "../services/cardRepository.js";
import { setProgress, ownedInSet } from "../services/cardService.js";

const router = Router();

// GET /api/sets -> alle Sets, für die "Alle Karten"-Übersichtsseite
router.get("/", (_req, res) => {
  res.json(listSetsLocal());
});

// GET /api/sets/progress -> { set_id: besessene_Karten } für die Fortschrittsanzeige
router.get("/progress", (_req, res) => {
  const map = {};
  for (const row of setProgress.all()) map[row.set_id] = row.owned;
  res.json(map);
});

// GET /api/sets/:setId -> Metadaten zu einem Set
router.get("/:setId", (req, res) => {
  const set = getSetLocal(req.params.setId);
  if (!set) return res.status(404).json({ error: "Set nicht gefunden" });
  res.json(set);
});

// GET /api/sets/:setId/cards -> alle Karten in diesem Set
router.get("/:setId/cards", (req, res) => {
  res.json(getCardsBySetLocal(req.params.setId));
});

// GET /api/sets/:setId/owned -> external_ids der Karten aus dem Set, die du besitzt
router.get("/:setId/owned", (req, res) => {
  res.json(ownedInSet.all(req.params.setId).map((r) => r.external_id));
});

export default router;
