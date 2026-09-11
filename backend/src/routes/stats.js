import { Router } from "express";
import { getMarketMovers, getTrackedSets, getWatchlistMovers, getSetMomentum, getThawing, getSetsOverview } from "../services/marketStats.js";

const router = Router();

const ALLOWED_DAYS = [7, 30, 120];
const parseDays = (v) => (ALLOWED_DAYS.includes(Number(v)) ? Number(v) : 7);

// GET /api/stats/market-movers?days=7|30|120&set=... -> größte Gewinner/
// Verlierer über alle jemals angesehenen Karten (nicht nur die eigene Sammlung).
router.get("/market-movers", (req, res) => {
  const setName = req.query.set ? String(req.query.set) : null;
  res.json(getMarketMovers({ days: parseDays(req.query.days), setName }));
});

// GET /api/stats/tracked-sets -> Set-Namen fürs Filter-Dropdown
router.get("/tracked-sets", (_req, res) => {
  res.json(getTrackedSets());
});

// GET /api/stats/watchlist-movers?days=7|30|120 -> Preisstatus der eigenen Watchlist
router.get("/watchlist-movers", (req, res) => {
  res.json(getWatchlistMovers(req.user.id, { days: parseDays(req.query.days) }));
});

// GET /api/stats/set-momentum?days=30 -> welche Sets bewegen sich am meisten
router.get("/set-momentum", (req, res) => {
  res.json(getSetMomentum({ days: parseDays(req.query.days) }));
});

// GET /api/stats/thawing -> lang gefallen, zuletzt aber wieder im Aufwind
router.get("/thawing", (_req, res) => {
  res.json(getThawing());
});

// GET /api/stats/sets-overview -> Preisübersicht über ALLE Sets, nicht nur
// zufällig angesehene Karten
router.get("/sets-overview", (_req, res) => {
  res.json(getSetsOverview());
});

export default router;
