import { Router } from "express";
import { getMarketMovers } from "../services/marketStats.js";
import { analysis } from "../services/analysisCache.js";
import { topValueSummary } from "../services/setTopValue.js";

const router = Router();

const ALLOWED_DAYS = [7, 30, 120];
const parseDays = (v) => (ALLOWED_DAYS.includes(Number(v)) ? Number(v) : 7);

// GET /api/stats/market-movers?days=7|30|120&set=... -> größte Gewinner/
// Verlierer über alle Karten mit Preishistorie (nicht nur die eigene Sammlung).
router.get("/market-movers", (req, res) => {
  const setName = req.query.set ? String(req.query.set) : null;
  res.json(getMarketMovers({ days: parseDays(req.query.days), setName }));
});

// GET /api/stats/sealed-movers?days=7|30 -> größte Gewinner/Verlierer der Sealed-Produkte (Nacht-Auswertung)
router.get("/sealed-movers", (req, res) => {
  res.json(analysis("sealedMovers")[req.query.days === "7" ? 7 : 30]);
});

// GET /api/stats/price-per-booster -> je Set die Sealed-Produkte nach Preis je Booster, dazu Booster-/Displaypreis
// (ohne Tagesverläufe; die kommen über /price-per-booster/history?sets=a,b nur für die im Graphen gewählten Sets)
let ppbSummary = { src: null, data: null };
router.get("/price-per-booster", (_req, res) => {
  const rows = analysis("pricePerBooster");
  if (ppbSummary.src !== rows) ppbSummary = { src: rows, data: rows.map(({ history, ...s }) => s) };
  res.json(ppbSummary.data);
});
router.get("/price-per-booster/history", (req, res) => {
  const ids = new Set(String(req.query.sets ?? "").split(",").filter(Boolean).slice(0, 60));
  res.json(analysis("pricePerBooster").filter((s) => ids.has(s.id)).map((s) => ({ id: s.id, history: s.history })));
});

// GET /api/stats/top-cards -> je Set Wert der Top 5/10/20 Karten, Monatsveränderung, Veränderung 30/90/180/365 Tage
// (ohne Tagesverlauf und Kartenliste; beides kommt über /top-cards/history?sets=a,b,c nur für die gewählten Sets)
let topSummary = { src: null, data: null };
router.get("/top-cards", (_req, res) => {
  const rows = analysis("setTopValue");
  if (topSummary.src !== rows) topSummary = { src: rows, data: topValueSummary(rows) };
  res.json(topSummary.data);
});
router.get("/top-cards/history", (req, res) => {
  const ids = new Set(String(req.query.sets ?? "").split(",").filter(Boolean).slice(0, 60));
  res.json(
    analysis("setTopValue")
      .filter((s) => ids.has(s.id))
      .map((s) => ({ id: s.id, cards: s.cards, history: Object.fromEntries(Object.entries(s.tops).map(([n, t]) => [n, t.history])) }))
  );
});

// GET /api/stats/set-total-value -> je Set Summe aller Kartenpreise, Verlauf und wertvollste Karte
router.get("/set-total-value", (_req, res) => {
  res.json(analysis("setTotalValue"));
});

// GET /api/stats/pull-rates -> Pull Rates aller Sets, bei denen welche hinterlegt sind
router.get("/pull-rates", (_req, res) => {
  res.json(analysis("pullRates"));
});

// GET /api/stats/pack-value -> erwarteter Wert pro Pack je Set (Pull Rates x Kartenpreise)
router.get("/pack-value", (_req, res) => {
  res.json(analysis("packValue"));
});

// GET /api/stats/pull-or-buy -> Chase-Karten je Set mit Preis und Quote (Ziehen oder kaufen)
router.get("/pull-or-buy", (_req, res) => {
  res.json(analysis("pullOrBuy"));
});

// GET /api/stats/landing -> Zahlen für die öffentliche Startseite: Anzahl Karten/Sets,
// die 3 Sets mit dem besten Verhältnis Kartenwert pro Pack zu Boosterpreis und die
// größten Preisbewegungen der letzten 30 Tage (alles aus den Nacht-Auswertungen).
// 30 statt 7 Tage (Justus 23.10.2026): über einen Monat setzen sich echte Marktbewegungen durch,
// einzelne falsche Tageswerte fallen kaum ins Gewicht - möglichst realistische Preisabbildung.
const moverFields = (m) => ({
  external_id: m.external_id,
  slug: m.slug,
  name: m.name,
  set_name: m.set_name,
  image_small: m.image_small,
  current: m.current,
  delta_pct: m.delta_pct,
});
// Auf der Startseite nur Bewegungen, die glaubwürdig wirken: ab 5 € und höchstens
// +/-100 % (bei Alt-Karten mit dünnem Handel sind größere Sprünge meist Datenrauschen).
const landingMovers = (list) =>
  list.filter((m) => m.current >= 5 && m.previous >= 5 && Math.abs(m.delta_pct) <= 100).slice(0, 3).map(moverFields);

router.get("/landing", (_req, res) => {
  const boosters = analysis("setRanking")
    .filter((s) => s.boosterPriceCents && s.packValue != null)
    .map((s) => ({
      id: s.id,
      slug: s.slug,
      name: s.name,
      hitRatePct: s.hitRatePct,
      hitRateComplete: s.hitRateComplete,
      packValue: s.packValue,
      boosterPriceCents: s.boosterPriceCents,
      ratio: (s.packValue / (s.boosterPriceCents / 100)) * 100,
    }))
    .sort((a, b) => b.ratio - a.ratio)
    .slice(0, 3);
  const movers = getMarketMovers({ days: 30, limit: Infinity });
  res.json({
    counts: analysis("siteCounts"),
    boosters,
    gainers: landingMovers(movers.gainers),
    losers: landingMovers(movers.losers),
  });
});

// GET /api/stats/set-ranking -> Hit Rate, Wert pro Pack, Top 20 je Set (Set-Rangliste)
router.get("/set-ranking", (_req, res) => {
  res.json(analysis("setRanking"));
});

// GET /api/stats/set-value -> Box-/Boosterpreis vs. Top-20-Kartenwert je Set
router.get("/set-value", (_req, res) => {
  res.json(analysis("setValue"));
});

export default router;
