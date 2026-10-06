import { Router } from "express";
import { listSetsLocal, getSetLocal, getCardsBySetLocal } from "../services/cardRepository.js";
import { setProgress, ownedInSet, pricesForSet } from "../services/cardService.js";
import { backfillSetPrices } from "../services/setPriceBackfill.js";
import { authRequired } from "../middleware/auth.js";
import { isOperatorUser } from "../lib/admin.js";
import db from "../db/index.js";

const router = Router();

const setBoxPriceStmt = db.prepare(`UPDATE card_sets SET box_price_cents = ? WHERE id = ?`);

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
  // Fehlende Preise im Hintergrund nachladen (blockiert die Antwort nicht) -
  // ab dem nächsten Aufruf/Reload sind dann mehr Karten bepreist.
  backfillSetPrices(req.params.setId);
});

// GET /api/sets/:setId/owned -> external_ids der Karten aus dem Set, die der Nutzer besitzt
router.get("/:setId/owned", authRequired, (req, res) => {
  res.json(ownedInSet.all(req.params.setId, req.user.id).map((r) => r.external_id));
});

// PATCH /api/sets/:setId/box-price -> Booster-Box-Preis setzen/ändern (nur
// Betreiber - es gibt keine freie API-Quelle dafür, das trägt Justus von
// Hand ein). { eur: 45.90 } oder { eur: null } zum Löschen.
router.patch("/:setId/box-price", authRequired, (req, res) => {
  if (!isOperatorUser(req.user)) {
    return res.status(403).json({ error: "Nur der Betreiber darf das ändern." });
  }
  const set = getSetLocal(req.params.setId);
  if (!set) return res.status(404).json({ error: "Set nicht gefunden" });

  const { eur } = req.body ?? {};
  let cents = null;
  if (eur != null && eur !== "") {
    const n = Number(eur);
    if (!Number.isFinite(n) || n < 0) {
      return res.status(400).json({ error: "Ungültiger Preis" });
    }
    cents = Math.round(n * 100);
  }
  setBoxPriceStmt.run(cents, req.params.setId);
  res.json({ box_price_cents: cents });
});

export default router;
