import { Router } from "express";
import {
  createSealedProduct,
  listSealedProducts,
  updateSealedProduct,
  deleteSealedProduct,
} from "../services/sealedProductService.js";

const router = Router();

// GET /api/sealed-products -> alle Sealed-Produkte des Nutzers
router.get("/", (req, res) => {
  res.json(listSealedProducts.all(req.user.id));
});

// POST /api/sealed-products { setId?, setName?, name, quantity, purchasePrice, shippingCost, purchaseDate, currentValue?, notes? }
router.post("/", (req, res) => {
  const { name } = req.body || {};
  if (!name || !name.trim()) return res.status(400).json({ error: "Name fehlt" });
  const id = createSealedProduct(req.user.id, req.body);
  res.status(201).json({ id });
});

// PATCH /api/sealed-products/:id -> Felder aktualisieren (v.a. currentValue)
router.patch("/:id", (req, res) => {
  const { name } = req.body || {};
  if (!name || !name.trim()) return res.status(400).json({ error: "Name fehlt" });
  const info = updateSealedProduct(req.user.id, req.params.id, req.body);
  if (info.changes === 0) return res.status(404).json({ error: "Nicht gefunden" });
  res.json({ ok: true });
});

// DELETE /api/sealed-products/:id
router.delete("/:id", (req, res) => {
  const info = deleteSealedProduct.run(req.params.id, req.user.id);
  if (info.changes === 0) return res.status(404).json({ error: "Nicht gefunden" });
  res.json({ ok: true });
});

export default router;
