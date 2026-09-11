import { Router } from "express";
import db from "../db/index.js";
import { getCardById } from "../services/pokemonTcgApi.js";
import {
  upsertCardRow,
  recordPrices,
  listCollection,
  latestTrend,
  cardmarketBreakdown,
} from "../services/cardService.js";
import { getCardByExternalIdLocal, matchCardForImport } from "../services/cardRepository.js";
import { getCardmarketPrices, cardmarketUrl } from "../services/priceProvider.js";
import { recordPortfolioSnapshot, sellCollectionItem } from "../services/portfolioService.js";

const router = Router();

const insertCollectionItem = db.prepare(`
  INSERT INTO collection_items
    (user_id, card_id, quantity, condition, purchase_price, shipping_cost, purchase_date, notes, language, variant,
     grading_company, grade)
  VALUES
    (@user_id, @card_id, @quantity, @condition, @purchase_price, @shipping_cost, @purchase_date, @notes, @language, @variant,
     @grading_company, @grade)
`);

const updateCollectionItem = db.prepare(`
  UPDATE collection_items SET
    quantity = @quantity, condition = @condition,
    purchase_price = @purchase_price, shipping_cost = @shipping_cost,
    purchase_date = @purchase_date, notes = @notes,
    language = COALESCE(@language, language),
    variant = COALESCE(@variant, variant),
    grading_company = @grading_company,
    grade = @grade
  WHERE id = @id AND user_id = @user_id
`);

const deleteCollectionItem = db.prepare(`DELETE FROM collection_items WHERE id = ? AND user_id = ?`);

const num = (v) => {
  if (v === "" || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const langOrNull = (v) => (v === "de" || v === "en" ? v : null);
const VARIANTS = ["normal", "holo", "reverse", "first_edition"];
const variantOrNull = (v) => (VARIANTS.includes(v) ? v : null);

// Grading: nur bekannte Firmen zulassen, Note als kurzer Text.
const GRADERS = ["PSA", "BGS", "CGC", "SGC", "AGS", "TAG", "ACE", "GG", "Andere"];
const gradingCompanyOrNull = (v) => {
  if (!v) return null;
  const hit = GRADERS.find((g) => g.toLowerCase() === String(v).trim().toLowerCase());
  if (hit) return hit;
  return String(v).trim().slice(0, 30) || null;
};
const gradeOrNull = (v) => {
  const s = String(v ?? "").trim();
  return s ? s.slice(0, 20) : null;
};
// Grading-Felder aus dem Request normalisieren. Nur gültig, wenn eine Firma
// angegeben ist - sonst beides NULL (ungegradete Karte).
const gradingFrom = (body) => {
  const company = gradingCompanyOrNull(body.gradingCompany);
  return {
    grading_company: company,
    grade: company ? gradeOrNull(body.grade) : null,
  };
};

// Cardmarket-Preis im Hintergrund nachziehen (blockiert die Antwort nie).
function refreshPriceInBackground(cardId, externalId) {
  getCardmarketPrices(externalId)
    .then(({ prices, meta }) => {
      if (prices.length) recordPrices(cardId, prices, meta);
    })
    .catch(() => {});
}

// GET /api/collection -> Sammlung inkl. aktuellem Cardmarket-Preis (EUR)
router.get("/", (req, res) => {
  const items = listCollection.all(req.user.id).map((item) => ({
    ...item,
    latest_price: latestTrend(item.card_id, item.variant || "normal"),
    price_breakdown: cardmarketBreakdown(item.card_id),
    cardmarket_url: cardmarketUrl(item.cardmarket_product_id),
  }));
  res.json(items);
});

// POST /api/collection
// { externalId, quantity, condition, purchasePrice, shippingCost, purchaseDate, notes, language }
router.post("/", async (req, res) => {
  const {
    externalId,
    quantity = 1,
    condition = "near_mint",
    purchasePrice,
    shippingCost,
    purchaseDate,
    notes,
    language,
    variant,
  } = req.body;
  if (!externalId) return res.status(400).json({ error: "externalId fehlt" });

  // Kartendaten aus der lokalen DB -> sofort. Fehlt die Karte lokal, einmal live nachladen.
  let cardData = getCardByExternalIdLocal(externalId);
  if (!cardData) {
    try {
      cardData = await getCardById(externalId, 6000);
    } catch (err) {
      return res.status(502).json({ error: err.message });
    }
  }

  let cardId;
  try {
    cardId = upsertCardRow("pokemon", cardData);
    insertCollectionItem.run({
      user_id: req.user.id,
      card_id: cardId,
      quantity: num(quantity) ?? 1,
      condition: condition || "near_mint",
      purchase_price: num(purchasePrice),
      shipping_cost: num(shippingCost),
      purchase_date: purchaseDate || null,
      notes: notes || null,
      language: langOrNull(language) ?? "en",
      variant: variantOrNull(variant) ?? "normal",
      ...gradingFrom(req.body),
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }

  res.status(201).json({ cardId });
  refreshPriceInBackground(cardId, externalId);
  recordPortfolioSnapshot(req.user.id);
});

// POST /api/collection/import/match  { rows: [{ name, number, set, ... }] }
// -> pro Zeile die beste Karten-Übereinstimmung + Alternativen (Vorschau).
router.post("/import/match", (req, res) => {
  const rows = Array.isArray(req.body?.rows) ? req.body.rows.slice(0, 500) : [];
  res.json(
    rows.map((row) => {
      const { best, candidates, confidence } = matchCardForImport({
        name: row.name,
        number: row.number,
        set: row.set,
      });
      return { input: row, best, candidates, confidence };
    })
  );
});

// POST /api/collection/import/commit  { items: [{ externalId, quantity, ... }] }
router.post("/import/commit", (req, res) => {
  const items = Array.isArray(req.body?.items) ? req.body.items.slice(0, 500) : [];
  if (!items.length) return res.status(400).json({ error: "keine Karten" });

  let added = 0;
  const externalIds = new Set();
  const userId = req.user.id;
  const tx = db.transaction(() => {
    for (const it of items) {
      const local = getCardByExternalIdLocal(it.externalId);
      if (!local) continue;
      const cardId = upsertCardRow("pokemon", local);
      insertCollectionItem.run({
        user_id: userId,
        card_id: cardId,
        quantity: num(it.quantity) ?? 1,
        condition: it.condition || "near_mint",
        purchase_price: num(it.purchasePrice),
        shipping_cost: num(it.shippingCost),
        purchase_date: it.purchaseDate || null,
        notes: it.notes || null,
        language: langOrNull(it.language) ?? "en",
        variant: variantOrNull(it.variant) ?? "normal",
        ...gradingFrom(it),
      });
      externalIds.add(it.externalId);
      added++;
    }
  });
  tx();

  res.json({ ok: true, added });
  recordPortfolioSnapshot(userId);

  // Preise nacheinander im Hintergrund nachziehen (TCGdex schonen)
  (async () => {
    for (const ext of externalIds) {
      try {
        const { prices, meta } = await getCardmarketPrices(ext);
        const local = getCardByExternalIdLocal(ext);
        if (prices.length && local) recordPrices(upsertCardRow("pokemon", local), prices, meta);
      } catch {
        /* ignore */
      }
      await new Promise((r) => setTimeout(r, 200));
    }
    recordPortfolioSnapshot(userId);
  })();
});

// PATCH /api/collection/:id
router.patch("/:id", (req, res) => {
  const { quantity, condition, purchasePrice, shippingCost, purchaseDate, notes, language, variant } =
    req.body;
  const info = updateCollectionItem.run({
    id: Number(req.params.id),
    user_id: req.user.id,
    quantity: num(quantity) ?? 1,
    condition: condition || "near_mint",
    purchase_price: num(purchasePrice),
    shipping_cost: num(shippingCost),
    purchase_date: purchaseDate || null,
    notes: notes || null,
    language: langOrNull(language),
    variant: variantOrNull(variant),
    ...gradingFrom(req.body),
  });
  if (!info.changes) return res.status(404).json({ error: "Eintrag nicht gefunden" });
  recordPortfolioSnapshot(req.user.id);
  res.json({ ok: true });
});

// POST /api/collection/:id/sell
// { salePrice, saleShipping, saleFees, soldOn, notes } -> in die Verkaufshistorie
router.post("/:id/sell", (req, res) => {
  const { salePrice, saleShipping, saleFees, soldOn, notes } = req.body;
  const ok = sellCollectionItem(
    req.params.id,
    {
      salePrice: num(salePrice),
      saleShipping: num(saleShipping),
      saleFees: num(saleFees),
      soldOn: soldOn || new Date().toISOString().slice(0, 10),
      notes: notes || null,
    },
    req.user.id
  );
  if (!ok) return res.status(404).json({ error: "Eintrag nicht gefunden" });
  recordPortfolioSnapshot(req.user.id);
  res.json({ ok: true });
});

// DELETE /api/collection/:id -> Karte ohne Verkauf aus der Sammlung entfernen
router.delete("/:id", (req, res) => {
  const info = deleteCollectionItem.run(Number(req.params.id), req.user.id);
  if (!info.changes) return res.status(404).json({ error: "Eintrag nicht gefunden" });
  recordPortfolioSnapshot(req.user.id);
  res.json({ ok: true });
});

export default router;
