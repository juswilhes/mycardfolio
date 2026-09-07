import { Router } from "express";
import { portfolioHistory, getMovers, recordPortfolioSnapshot } from "../services/portfolioService.js";

const router = Router();

// GET /api/portfolio/history -> Tagespunkte für den Wert-über-Zeit-Graphen
router.get("/history", (_req, res) => {
  // sicherstellen, dass der heutige Punkt aktuell ist
  recordPortfolioSnapshot();
  res.json(portfolioHistory.all());
});

// GET /api/portfolio/movers -> Top-Gewinner / -Verlierer der letzten 7 Tage
router.get("/movers", (_req, res) => {
  res.json(getMovers());
});

export default router;
