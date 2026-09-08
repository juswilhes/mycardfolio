import { Router } from "express";
import {
  portfolioHistory,
  computePortfolioHistory,
  getMovers,
  recordPortfolioSnapshot,
} from "../services/portfolioService.js";

const router = Router();

// GET /api/portfolio/history -> Tagespunkte für den Wert-über-Zeit-Graphen.
// Ohne Filter: die gespeicherten Gesamt-Snapshots. Mit ?set=/?language=/
// ?artist=: aus den Preis-Snapshots berechnete Teilmenge.
router.get("/history", (req, res) => {
  const { set, language, artist } = req.query;
  if (set || language || artist) {
    return res.json(
      computePortfolioHistory({
        set: set || null,
        language: language || null,
        artist: artist || null,
      })
    );
  }
  // sicherstellen, dass der heutige Punkt aktuell ist
  recordPortfolioSnapshot();
  res.json(portfolioHistory.all());
});

// GET /api/portfolio/movers -> Top-Gewinner / -Verlierer der letzten 7 Tage
router.get("/movers", (_req, res) => {
  res.json(getMovers());
});

export default router;
