import { Router } from "express";
import { catalogItem } from "../services/sealedCatalog.js";
import { searchSealed } from "../services/sealedSearch.js";
import { slugOfSet } from "../services/setSlugs.js";

const router = Router();

// GET /api/sealed-catalog/search?q=Top-Trainer-Box -> { total, items } (deutsch und englisch, öffentlich).
// Muss vor "/:id" stehen, sonst wäre "search" eine Produkt-ID.
router.get("/search", (req, res) => {
  const q = String(req.query.q ?? "").trim().slice(0, 100);
  if (q.length < 2) return res.json({ total: 0, items: [] });
  res.json(searchSealed(q));
});

// GET /api/sealed-catalog/:id -> ein versiegeltes Produkt mit Preisverlauf (öffentlich, Produktseite)
router.get("/:id", (req, res) => {
  const item = catalogItem(Number(req.params.id));
  if (!item) return res.status(404).json({ error: "Produkt nicht gefunden" });
  res.json({ ...item, setSlug: item.setId ? slugOfSet(item.setId) : null });
});

export default router;
