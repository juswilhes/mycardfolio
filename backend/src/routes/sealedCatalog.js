import { Router } from "express";
import { catalogItem } from "../services/sealedCatalog.js";
import { slugOfSet } from "../services/setSlugs.js";

const router = Router();

// GET /api/sealed-catalog/:id -> ein versiegeltes Produkt mit Preisverlauf (öffentlich, Produktseite)
router.get("/:id", (req, res) => {
  const item = catalogItem(Number(req.params.id));
  if (!item) return res.status(404).json({ error: "Produkt nicht gefunden" });
  res.json({ ...item, setSlug: item.setId ? slugOfSet(item.setId) : null });
});

export default router;
