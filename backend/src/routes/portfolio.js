import { Router } from "express";
import {
  portfolioHistory,
  computePortfolioHistory,
  addSealedToHistory,
  sealedOnlyHistory,
  getMovers,
  recordPortfolioSnapshot,
} from "../services/portfolioService.js";

const router = Router();

// GET /api/portfolio/history -> Tagespunkte für den Wert-über-Zeit-Graphen.
// Ohne Filter: die gespeicherten Snapshots des Nutzers. Mit ?set=/?language=/
// ?artist=: aus den Preis-Snapshots berechnete Teilmenge.
router.get("/history", (req, res) => {
  const { set, language, artist } = req.query;
  // ?scope=sealed: Reiter "Sealed" - Verlauf nur der versiegelten Produkte
  if (req.query.scope === "sealed") return res.json(sealedOnlyHistory(req.user.id));
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
  const rows = portfolioHistory.all(req.user.id);
  // ?scope=all: Gesamt-Ansicht der Sammlung, mit Sealed-Produkten
  res.json(req.query.scope === "all" ? addSealedToHistory(req.user.id, rows) : rows);
});

// GET /api/portfolio/movers -> Top-Gewinner / -Verlierer der letzten 7 Tage
router.get("/movers", (req, res) => {
  res.json(getMovers(req.user.id));
});

export default router;
