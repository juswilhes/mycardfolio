import { Router } from "express";
import { getMarketMovers, getSetValueAnalysis, getPullRateOverview, getPackValueAnalysis, getPullOrBuy } from "../services/marketStats.js";

const router = Router();

const ALLOWED_DAYS = [7, 30, 120];
const parseDays = (v) => (ALLOWED_DAYS.includes(Number(v)) ? Number(v) : 7);

// GET /api/stats/market-movers?days=7|30|120&set=... -> größte Gewinner/
// Verlierer über alle Karten mit Preishistorie (nicht nur die eigene Sammlung).
router.get("/market-movers", (req, res) => {
  const setName = req.query.set ? String(req.query.set) : null;
  res.json(getMarketMovers({ days: parseDays(req.query.days), setName }));
});

// GET /api/stats/pull-rates -> Pull Rates aller Sets, bei denen welche hinterlegt sind
router.get("/pull-rates", (_req, res) => {
  res.json(getPullRateOverview());
});

// GET /api/stats/pack-value -> erwarteter Wert pro Pack je Set (Pull Rates x Kartenpreise)
router.get("/pack-value", (_req, res) => {
  res.json(getPackValueAnalysis());
});

// GET /api/stats/pull-or-buy -> Chase-Karten je Set mit Preis und Quote (Ziehen oder kaufen)
router.get("/pull-or-buy", (_req, res) => {
  res.json(getPullOrBuy());
});

// GET /api/stats/set-value -> Box-/Boosterpreis vs. Top-20-Kartenwert je Set
router.get("/set-value", (_req, res) => {
  res.json(getSetValueAnalysis());
});

export default router;
