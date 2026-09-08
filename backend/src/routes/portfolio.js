import { Router } from "express";
import {
  portfolioHistory,
  computePortfolioHistory,
  getMovers,
  recordPortfolioSnapshot,
} from "../services/portfolioService.js";

const router = Router();

// GET /api/portfolio/history -> Tagespunkte für den Wert-über-Zeit-Graphen.
// Ohne Filter: die gespeicherten Snapshots des Nutzers. Mit ?set=/?language=/
// ?artist=: aus den Preis-Snapshots berechnete Teilmenge.
router.get("/history", (req, res) => {
  const { set, language, artist } = req.query;
  if (set || language || artist) {
    return res.json(
      computePortfolioHistory(req.user.id, {
        set: set || null,
        language: language || null,
        artist: artist || null,
      })
    );
  }
  recordPortfolioSnapshot(req.user.id);
  res.json(portfolioHistory.all(req.user.id));
});

// GET /api/portfolio/movers -> Top-Gewinner / -Verlierer der letzten 7 Tage
router.get("/movers", (req, res) => {
  res.json(getMovers(req.user.id));
});

export default router;
