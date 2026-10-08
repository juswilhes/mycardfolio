import db from "../db/index.js";
import { priceHistoryForCard, latestTrend } from "./cardService.js";

// Alle Karten, für die wir überhaupt eine Preishistorie haben (nicht nur die
// in einer Sammlung) - Grundlage für eine marktweite, nutzerunabhängige
// Auswertung statt nur des eigenen Portfolios.
const trackedCardsStmt = db.prepare(`
  SELECT DISTINCT c.id, c.external_id, c.name, c.set_name, c.image_small
  FROM cards c
  JOIN price_snapshots ps ON ps.card_id = c.id
`);

function moverFor(c, days) {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  const hist = priceHistoryForCard.all(c.id);
  if (!hist.length) return null;

  const latest = hist[hist.length - 1];
  let base = hist[0];
  for (const h of hist) {
    if (new Date(h.fetched_at).getTime() <= cutoff) base = h;
    else break;
  }

  return {
    card_id: c.id,
    external_id: c.external_id,
    name: c.name,
    set_name: c.set_name,
    image_small: c.image_small,
    current: latest.price,
    previous: base.price,
    delta: latest.price - base.price,
    delta_pct: base.price ? ((latest.price - base.price) / base.price) * 100 : 0,
    since: base.fetched_at,
    singlePoint: hist.length < 2,
  };
}

// Analyse "Booster vs. Top-Karten": je Set mit hinterlegtem Box- und/oder
// Boosterpreis der Gesamtwert der 20 teuersten Karten. Der Preis je Karte ist
// derselbe wie auf der Kartenseite (latestTrend). Die Verhältnisse (Top 20 vs.
// Box/Booster) rechnet das Frontend.
const pricedSetsStmt = db.prepare(`
  SELECT id, name, series, release_date, logo, box_price_cents, booster_price_cents, prices_updated_at
  FROM card_sets WHERE box_price_cents IS NOT NULL OR booster_price_cents IS NOT NULL
`);
const setCardsStmt = db.prepare(`SELECT id, external_id, name, image_small FROM cards WHERE set_id = ?`);

const setValueHistoryStmt = db.prepare(`
  SELECT set_id, month, box_price_cents, booster_price_cents, top20_value, top20_count
  FROM set_value_snapshots ORDER BY month
`);

export function getSetValueAnalysis() {
  const history = new Map();
  for (const h of setValueHistoryStmt.all()) {
    if (!history.has(h.set_id)) history.set(h.set_id, []);
    history.get(h.set_id).push({
      month: h.month,
      boxPriceCents: h.box_price_cents,
      boosterPriceCents: h.booster_price_cents,
      top20Value: h.top20_value,
      top20Count: h.top20_count,
    });
  }

  return pricedSetsStmt.all().map((r) => {
    const cards = setCardsStmt
      .all(r.id)
      .map((c) => ({ ...c, price: latestTrend(c.id)?.price ?? null }))
      .filter((c) => c.price != null)
      .sort((a, b) => b.price - a.price);
    const top = cards.slice(0, 20);
    return {
      id: r.id,
      name: r.name,
      series: r.series,
      release_date: r.release_date,
      logo: r.logo,
      boxPriceCents: r.box_price_cents,
      boosterPriceCents: r.booster_price_cents,
      pricesUpdatedAt: r.prices_updated_at,
      top20Value: Math.round(top.reduce((sum, c) => sum + c.price, 0) * 100) / 100,
      top20Count: top.length,
      pricedCards: cards.length,
      topCards: top.map((c) => ({ external_id: c.external_id, name: c.name, image_small: c.image_small, price: c.price })),
      history: history.get(r.id) ?? [],
    };
  });
}

// Analyse "Pull Rates": alle Sets mit hinterlegten Pull Rates (von Hand
// gepflegt, siehe routes/sets.js) - das Frontend baut daraus die Matrix
// Seltenheit x Set. Dazu je Set die berechnete Hit Rate.
const pullRateRowsStmt = db.prepare(`
  SELECT cs.id, cs.name, cs.series, cs.release_date,
         pr.rarity, pr.any_denominator, pr.specific_denominator
  FROM card_sets cs
  JOIN pull_rates pr ON pr.set_id = cs.id
  ORDER BY cs.release_date DESC, cs.id
`);
const rarityCountsStmt = db.prepare(`
  SELECT set_id, rarity, COUNT(*) AS n FROM cards
  WHERE set_id IN (SELECT DISTINCT set_id FROM pull_rates) AND rarity IS NOT NULL
  GROUP BY set_id, rarity
`);

// Sets, deren Karten aus den Boostern eines anderen Sets gezogen werden: die
// Classic Collection steckt in den Boostern des 30th Celebration. Beide teilen
// sich deshalb eine Hit Rate (gerechnet über alle Seltenheiten beider Sets).
const BOOSTER_OF = { "30th-c": "30th" };
const boosterOf = (setId) => BOOSTER_OF[setId] ?? setId;

const normRarity = (r) => r.trim().toLowerCase().replace(/_/g, " ").replace(/s+/g, " ");
// Keine "Treffer": alles, was in jedem Pack ohnehin zu erwarten ist.
const NO_HIT_RARITIES = new Set(["common", "uncommon", "rare", "double rare", "pikachu rare"]);

// Hit Rate = Chance, dass ein Pack mindestens eine besondere Karte enthält
// (jede Seltenheit außer NO_HIT_RARITIES). Pro Seltenheit zählt die Chance,
// dass das Pack IRGENDEINE Karte davon enthält: "jede 1/X" direkt, sonst
// Kartenanzahl der Seltenheit / "diese 1/Y". Die Seltenheiten werden als
// voneinander unabhängig behandelt (1 - Produkt der Gegenchancen) - eine
// Näherung, die nie über 100 % kommt. complete=false: für mindestens eine
// Seltenheit fehlten die Angaben, der Wert ist dann nur eine Untergrenze.
function hitRateFor(rows, counts) {
  let miss = 1;
  let used = 0;
  let complete = true;
  for (const r of rows) {
    const key = normRarity(r.rarity);
    if (NO_HIT_RARITIES.has(key)) continue;
    const n = counts.get(key) ?? 0;
    const p = r.any_denominator ? 1 / r.any_denominator : r.specific_denominator && n ? Math.min(1, n / r.specific_denominator) : null;
    if (p == null) {
      complete = false;
      continue;
    }
    miss *= 1 - p;
    used++;
  }
  if (!used) return { hitRatePct: null, hitRateComplete: false };
  return { hitRatePct: Math.round((1 - miss) * 1000) / 10, hitRateComplete: complete };
}

export function getPullRateOverview() {
  const counts = new Map();
  for (const c of rarityCountsStmt.all()) {
    if (!counts.has(c.set_id)) counts.set(c.set_id, new Map());
    const m = counts.get(c.set_id);
    const key = normRarity(c.rarity);
    m.set(key, (m.get(key) ?? 0) + c.n);
  }

  // Zeilen und Kartenzahlen je Booster (statt je Set) zusammenfassen
  const byBooster = new Map();
  const bySet = new Map();
  for (const r of pullRateRowsStmt.all()) {
    const b = boosterOf(r.id);
    if (!byBooster.has(b)) byBooster.set(b, { rows: [], counts: new Map() });
    byBooster.get(b).rows.push(r);
    let s = bySet.get(r.id);
    if (!s) {
      s = { id: r.id, name: r.name, series: r.series, release_date: r.release_date, rarities: [] };
      bySet.set(r.id, s);
    }
    s.rarities.push({ rarity: r.rarity, anyDenominator: r.any_denominator, specificDenominator: r.specific_denominator });
  }
  for (const [setId, m] of counts) {
    const target = byBooster.get(boosterOf(setId));
    if (!target) continue;
    for (const [key, n] of m) target.counts.set(key, (target.counts.get(key) ?? 0) + n);
  }
  return [...bySet.values()].map((s) => {
    const b = byBooster.get(boosterOf(s.id));
    return { ...s, ...hitRateFor(b.rows, b.counts) };
  });
}

// Unter diesem Betrag verzerren schon einzelne Cent den Prozentwert (z.B.
// 0,02 € -> 0,05 € sieht wie "+150 %" aus, ist aber keine echte Bewegung).
const MOVER_MIN_PRICE = 0.5;
// Jenseits dieser Marke handelt es sich praktisch immer um einen Daten-/
// Zuordnungsfehler der Quelle statt um eine echte Marktbewegung - typisch
// bei frisch getrackten "Black Star Promos" mit dünner Handelstiefe, wo der
// allererste Preispunkt kurz nach Trackingbeginn noch falsch zugeordnet war
// und sich dann auf einen realistischen (aber viel höheren/niedrigeren)
// Wert "korrigiert" hat. Eine Karte, die binnen 30 Tagen ihr Vielfaches
// wert sein soll, ist fast nie ein echter Markttrend.
const MOVER_MAX_ABS_PCT = 300;

function isPlausibleMove(m) {
  if (m.current < MOVER_MIN_PRICE || m.previous < MOVER_MIN_PRICE) return false;
  if (Math.abs(m.delta_pct) > MOVER_MAX_ABS_PCT) return false;
  return true;
}

// Die Berechnung geht über alle Karten mit Preishistorie (20.000+) und
// blockiert den Server dabei knapp eine Sekunde. Die Preise ändern sich nur
// einmal täglich (Preis-Job um 1 Uhr) - also für alle Besucher kurz
// zwischenspeichern statt bei jedem Aufruf neu zu rechnen.
const MOVERS_CACHE_MS = 30 * 60 * 1000;
const moversCache = new Map();

// Größte Gewinner/Verlierer (Trendpreis, Variante 'normal') über alle
// Karten mit Preishistorie - unabhängig davon, wer sie besitzt.
// Optional auf ein Set eingeschränkt.
export function getMarketMovers({ days = 7, limit = 25, setName = null } = {}) {
  const key = `${days}|${limit}|${setName ?? ""}`;
  const hit = moversCache.get(key);
  if (hit && Date.now() - hit.at < MOVERS_CACHE_MS) return hit.value;

  const cards = trackedCardsStmt.all().filter((c) => !setName || c.set_name === setName);
  const movers = cards
    .map((c) => moverFor(c, days))
    .filter((m) => m && !m.singlePoint && Math.abs(m.delta) >= 0.01 && m.previous)
    .filter(isPlausibleMove);

  const gainers = movers.filter((m) => m.delta > 0).sort((a, b) => b.delta_pct - a.delta_pct).slice(0, limit);
  const losers = movers.filter((m) => m.delta < 0).sort((a, b) => a.delta_pct - b.delta_pct).slice(0, limit);
  const value = { gainers, losers, trackedCount: movers.length };
  moversCache.set(key, { at: Date.now(), value });
  return value;
}
