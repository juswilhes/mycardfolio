import { Router } from "express";
import { listSales, deleteSale, undoSale, recordPortfolioSnapshot } from "../services/portfolioService.js";

const router = Router();

// GET /api/sales -> Verkaufshistorie + realisierter Gewinn/Verlust
router.get("/", (_req, res) => {
  res.json(listSales());
});

// POST /api/sales/:id/undo -> Verkauf rückgängig: Karte zurück in die Sammlung
router.post("/:id/undo", (req, res) => {
  const ok = undoSale(req.params.id);
  if (!ok) return res.status(404).json({ error: "Verkauf nicht gefunden" });
  recordPortfolioSnapshot();
  res.json({ ok: true });
});

// DELETE /api/sales/:id -> nur den Verkaufseintrag löschen (Karte kommt NICHT zurück)
router.delete("/:id", (req, res) => {
  const ok = deleteSale(req.params.id);
  if (!ok) return res.status(404).json({ error: "Verkauf nicht gefunden" });
  recordPortfolioSnapshot();
  res.json({ ok: true });
});

export default router;
