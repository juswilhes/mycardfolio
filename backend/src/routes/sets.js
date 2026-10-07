import { Router } from "express";
import { listSetsLocal, getSetLocal, getCardsBySetLocal } from "../services/cardRepository.js";
import { setProgress, ownedInSet, pricesForSet } from "../services/cardService.js";
import { backfillSetPrices } from "../services/setPriceBackfill.js";
import { authRequired } from "../middleware/auth.js";
import { isOperatorUser } from "../lib/admin.js";
import db from "../db/index.js";

const router = Router();

const setPricesStmt = db.prepare(
  `UPDATE card_sets SET box_price_cents = ?, booster_price_cents = ?, prices_updated_at = ? WHERE id = ?`
);
const setChaseHitRateStmt = db.prepare(`UPDATE card_sets SET chase_hit_rate_pct = ? WHERE id = ?`);
const pullRatesForSetStmt = db.prepare(`SELECT rarity, any_denominator, specific_denominator FROM pull_rates WHERE set_id = ? ORDER BY rarity`);
const upsertPullRateStmt = db.prepare(`
  INSERT INTO pull_rates (set_id, rarity, any_denominator, specific_denominator)
  VALUES (@set_id, @rarity, @any_denominator, @specific_denominator)
  ON CONFLICT(set_id, rarity) DO UPDATE SET
    any_denominator = excluded.any_denominator,
    specific_denominator = excluded.specific_denominator
`);
const deletePullRateStmt = db.prepare(`DELETE FROM pull_rates WHERE set_id = ? AND rarity = ?`);

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

// "45.90" -> 4590, ""/null -> null, Ungültiges -> undefined
function eurToCents(v) {
  if (v == null || v === "") return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return undefined;
  return Math.round(n * 100);
}

// PATCH /api/sets/:setId/prices -> Box- und Boosterpreis setzen/ändern (nur
// Betreiber - es gibt keine freie API-Quelle dafür, das trägt Justus von
// Hand ein). { boxEur, boosterEur }, jeweils null zum Löschen. Sondersets
// ohne Display haben nur einen Boosterpreis.
router.patch("/:setId/prices", authRequired, (req, res) => {
  if (!isOperatorUser(req.user)) {
    return res.status(403).json({ error: "Nur der Betreiber darf das ändern." });
  }
  const set = getSetLocal(req.params.setId);
  if (!set) return res.status(404).json({ error: "Set nicht gefunden" });

  const box = eurToCents(req.body?.boxEur);
  const booster = eurToCents(req.body?.boosterEur);
  if (box === undefined || booster === undefined) {
    return res.status(400).json({ error: "Ungültiger Preis" });
  }
  setPricesStmt.run(box, booster, new Date().toISOString(), req.params.setId);
  res.json({ box_price_cents: box, booster_price_cents: booster });
});

// GET /api/sets/:setId/pull-rates -> öffentlich. { chaseHitRatePct, rarities: [...] }
router.get("/:setId/pull-rates", (req, res) => {
  const set = getSetLocal(req.params.setId);
  if (!set) return res.status(404).json({ error: "Set nicht gefunden" });
  res.json({
    chaseHitRatePct: set.chase_hit_rate_pct ?? null,
    rarities: pullRatesForSetStmt.all(req.params.setId).map((r) => ({
      rarity: r.rarity,
      anyDenominator: r.any_denominator,
      specificDenominator: r.specific_denominator,
    })),
  });
});

// PATCH /api/sets/:setId/pull-rates -> nur Betreiber, keine freie API-Quelle
// dafür (Hand-Eingabe aus Booster-Auswertungen wie TCGplayer/PikaPika).
// Body: { chaseHitRatePct: 34 | null, rarities: [{ rarity, anyDenominator, specificDenominator }] }
// Ein rarity-Eintrag ohne beide Werte (null/leer) löscht die Zeile wieder.
router.patch("/:setId/pull-rates", authRequired, (req, res) => {
  if (!isOperatorUser(req.user)) {
    return res.status(403).json({ error: "Nur der Betreiber darf das ändern." });
  }
  const set = getSetLocal(req.params.setId);
  if (!set) return res.status(404).json({ error: "Set nicht gefunden" });

  const { chaseHitRatePct, rarities } = req.body ?? {};

  let hitRate = null;
  if (chaseHitRatePct != null && chaseHitRatePct !== "") {
    const n = Number(chaseHitRatePct);
    if (!Number.isFinite(n) || n < 0 || n > 100) {
      return res.status(400).json({ error: "Ungültige Trefferquote (0-100)" });
    }
    hitRate = n;
  }
  setChaseHitRateStmt.run(hitRate, req.params.setId);

  for (const r of rarities ?? []) {
    if (!r.rarity) continue;
    const any = r.anyDenominator != null && r.anyDenominator !== "" ? Number(r.anyDenominator) : null;
    const specific = r.specificDenominator != null && r.specificDenominator !== "" ? Number(r.specificDenominator) : null;
    if (any == null && specific == null) {
      deletePullRateStmt.run(req.params.setId, r.rarity);
      continue;
    }
    if ((any != null && !Number.isFinite(any)) || (specific != null && !Number.isFinite(specific))) {
      return res.status(400).json({ error: `Ungültiger Wert bei "${r.rarity}"` });
    }
    upsertPullRateStmt.run({
      set_id: req.params.setId,
      rarity: r.rarity,
      any_denominator: any,
      specific_denominator: specific,
    });
  }

  res.json({
    chaseHitRatePct: hitRate,
    rarities: pullRatesForSetStmt.all(req.params.setId).map((r) => ({
      rarity: r.rarity,
      anyDenominator: r.any_denominator,
      specificDenominator: r.specific_denominator,
    })),
  });
});

export default router;
