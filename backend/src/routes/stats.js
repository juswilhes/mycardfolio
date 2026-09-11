import { Router } from "express";
import { getMarketMovers } from "../services/marketStats.js";

const router = Router();

// GET /api/stats/market-movers?days=7|30 -> größte Gewinner/Verlierer über
// alle jemals angesehenen Karten (nicht nur die eigene Sammlung).
router.get("/market-movers", (req, res) => {
  const days = Number(req.query.days) === 30 ? 30 : 7;
  res.json(getMarketMovers({ days }));
});

export default router;
