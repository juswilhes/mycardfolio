import { Router } from "express";
import { getMarketMovers, getTrackedSets, getWatchlistMovers } from "../services/marketStats.js";

const router = Router();

// GET /api/stats/market-movers?days=7|30&set=... -> größte Gewinner/Verlierer
// über alle jemals angesehenen Karten (nicht nur die eigene Sammlung).
router.get("/market-movers", (req, res) => {
  const days = Number(req.query.days) === 30 ? 30 : 7;
  const setName = req.query.set ? String(req.query.set) : null;
  res.json(getMarketMovers({ days, setName }));
});

// GET /api/stats/tracked-sets -> Set-Namen fürs Filter-Dropdown
router.get("/tracked-sets", (_req, res) => {
  res.json(getTrackedSets());
});

// GET /api/stats/watchlist-movers?days=7|30 -> Preisstatus der eigenen Watchlist
router.get("/watchlist-movers", (req, res) => {
  const days = Number(req.query.days) === 30 ? 30 : 7;
  res.json(getWatchlistMovers(req.user.id, { days }));
});

export default router;
