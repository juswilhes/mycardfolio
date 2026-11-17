import { Router } from "express";
import { getCardById } from "../services/pokemonTcgApi.js";
import { upsertCardRow } from "../services/cardService.js";
import { getCardByExternalIdLocal } from "../services/cardRepository.js";
import { cardmarketLink } from "../services/cardmarketLinks.js";
import {
  addToWatchlist,
  removeFromWatchlist,
  listWatchlist,
  watchedExternalIds,
  addSealedToWatchlist,
  removeSealedFromWatchlist,
  listSealedWatchlist,
  watchedSealedIds,
} from "../services/watchlistService.js";

const router = Router();

// GET /api/watchlist -> vollständige Liste inkl. aktuellem Preis
router.get("/", (req, res) => {
  res.json(
    listWatchlist(req.user.id).map((item) => ({
      ...item,
      cardmarket_url: cardmarketLink(item),
    }))
  );
});

// GET /api/watchlist/ids -> nur externalIds, fürs Herzchen auf Suche/Set-Seiten
router.get("/ids", (req, res) => {
  res.json(watchedExternalIds(req.user.id));
});

// --- Sealed-Produkte (Katalog-ID) ---
// GET /api/watchlist/sealed -> gemerkte Sealed-Produkte mit aktuellem Wert
router.get("/sealed", (req, res) => {
  res.json(listSealedWatchlist(req.user.id));
});
// GET /api/watchlist/sealed/ids -> nur Katalog-IDs, fürs Herzchen
router.get("/sealed/ids", (req, res) => {
  res.json(watchedSealedIds(req.user.id));
});
// POST /api/watchlist/sealed { catalogId }
router.post("/sealed", (req, res) => {
  const catalogId = Number(req.body?.catalogId);
  if (!Number.isInteger(catalogId) || catalogId <= 0) return res.status(400).json({ error: "catalogId fehlt" });
  if (!addSealedToWatchlist(req.user.id, catalogId)) return res.status(404).json({ error: "Produkt nicht gefunden" });
  res.status(201).json({ ok: true });
});
// DELETE /api/watchlist/sealed/:catalogId
router.delete("/sealed/:catalogId", (req, res) => {
  const ok = removeSealedFromWatchlist(req.user.id, Number(req.params.catalogId));
  if (!ok) return res.status(404).json({ error: "Nicht auf der Watchlist" });
  res.json({ ok: true });
});

// POST /api/watchlist { externalId }
router.post("/", async (req, res) => {
  const { externalId } = req.body ?? {};
  if (!externalId) return res.status(400).json({ error: "externalId fehlt" });

  let cardData = getCardByExternalIdLocal(externalId);
  if (!cardData) {
    try {
      cardData = await getCardById(externalId, 6000);
    } catch (err) {
      return res.status(502).json({ error: err.message });
    }
  }

  const cardId = upsertCardRow("pokemon", cardData);
  addToWatchlist(req.user.id, cardId);
  res.status(201).json({ ok: true });
});

// DELETE /api/watchlist/:externalId
router.delete("/:externalId", (req, res) => {
  const ok = removeFromWatchlist(req.user.id, req.params.externalId);
  if (!ok) return res.status(404).json({ error: "Nicht auf der Watchlist" });
  res.json({ ok: true });
});

export default router;
