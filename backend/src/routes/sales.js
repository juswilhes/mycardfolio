import { Router } from "express";
import { listSales, deleteSale } from "../services/portfolioService.js";
import { recordPortfolioSnapshot } from "../services/portfolioService.js";

const router = Router();

// GET /api/sales -> Verkaufshistorie + realisierter Gewinn/Verlust
router.get("/", (_req, res) => {
  res.json(listSales());
});

// DELETE /api/sales/:id -> Verkauf rückgängig (Eintrag entfernen)
router.delete("/:id", (req, res) => {
  const ok = deleteSale(req.params.id);
  if (!ok) return res.status(404).json({ error: "Verkauf nicht gefunden" });
  recordPortfolioSnapshot();
  res.json({ ok: true });
});

export default router;
