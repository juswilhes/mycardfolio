import { Router } from "express";
import { listSetsLocal, getSetLocal, getCardsBySetLocal } from "../services/cardRepository.js";
import { setProgress, ownedInSet, pricesForSet } from "../services/cardService.js";
import { authRequired } from "../middleware/auth.js";

const router = Router();

// GET /api/sets -> alle Sets, für die "Alle Karten"-Übersichtsseite (öffentlich)
router.get("/", (_req, res) => {
  res.json(listSetsLocal());
});

// GET /api/sets/progress -> { set_id: besessene_Karten } (nur mit Login)
router.get("/progress", authRequired, (req, res) => {
  const map = {};
  for (const row of setProgress.all(req.user.id)) map[row.set_id] = row.owned;
  res.json(map);
});

// GET /api/sets/:setId -> Metadaten zu einem Set (öffentlich)
router.get("/:setId", (req, res) => {
  const set = getSetLocal(req.params.setId);
  if (!set) return res.status(404).json({ error: "Set nicht gefunden" });
  res.json(set);
});

// GET /api/sets/:setId/cards -> alle Karten in diesem Set inkl. aktuellem
// Preis (öffentlich) - für Sortierung/Anzeige nach Preis in der Übersicht.
router.get("/:setId/cards", (req, res) => {
  const cards = getCardsBySetLocal(req.params.setId);
  const prices = pricesForSet(req.params.setId);
  res.json(cards.map((c) => ({ ...c, price: prices.get(c.external_id) ?? null })));
});

// GET /api/sets/:setId/owned -> external_ids der Karten aus dem Set, die der Nutzer besitzt
router.get("/:setId/owned", authRequired, (req, res) => {
  res.json(ownedInSet.all(req.params.setId, req.user.id).map((r) => r.external_id));
});

export default router;
