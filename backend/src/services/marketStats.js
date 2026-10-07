import db from "../db/index.js";
import { priceHistoryForCard } from "./cardService.js";

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

// Aktueller Preis einer Karte (30-Tage-Schnitt, normal), als Ausdruck für eine
// SQL-Abfrage über "cards c" - dieselbe Logik wie cardService.js latestTrend():
// ohne Daten der letzten 30 Tage der letzte bekannte Einzelwert.
// Bewusst als korrelierte Teilabfrage je Karte (nutzt idx_price_card) statt
// über die View card_price_avg30 zu joinen: der Join würde bei 20.000+
// Karten die View jedes Mal komplett neu berechnen und den Server minuten-
// lang blockieren.
export const CARD_CURRENT_PRICE_SQL = `
  COALESCE(
    (SELECT AVG(ps.price) FROM price_snapshots ps
     WHERE ps.card_id = c.id AND ps.price_type = 'trend' AND ps.variant = 'normal'
       AND ps.source = 'cardmarket' AND ps.fetched_at >= datetime('now', '-30 days')),
    (SELECT ps2.price FROM price_snapshots ps2
     WHERE ps2.card_id = c.id AND ps2.price_type = 'trend' AND ps2.variant = 'normal'
     ORDER BY (ps2.source = 'cardmarket') DESC, ps2.fetched_at DESC LIMIT 1)
  )
`;

// Analyse "Booster vs. Top-Karten": je Set mit hinterlegtem Box- und/oder
// Boosterpreis der Gesamtwert der 20 teuersten Karten (30-Tage-Schnitt je
// Karte). Die Verhältnisse (Top 20 vs. Box/Booster) rechnet das Frontend.
const setValueRowsStmt = db.prepare(`
  SELECT cs.id, cs.name, cs.series, cs.release_date, cs.logo,
         cs.box_price_cents, cs.booster_price_cents, cs.prices_updated_at,
         c.external_id, c.name AS card_name, c.image_small,
         ${CARD_CURRENT_PRICE_SQL} AS price
  FROM card_sets cs
  LEFT JOIN cards c ON c.set_id = cs.id
  WHERE cs.box_price_cents IS NOT NULL OR cs.booster_price_cents IS NOT NULL
  ORDER BY cs.id, price DESC
`);

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

  const bySet = new Map();
  for (const r of setValueRowsStmt.all()) {
    let s = bySet.get(r.id);
    if (!s) {
      s = {
        id: r.id,
        name: r.name,
        series: r.series,
        release_date: r.release_date,
        logo: r.logo,
        boxPriceCents: r.box_price_cents,
        boosterPriceCents: r.booster_price_cents,
        pricesUpdatedAt: r.prices_updated_at,
        top20Value: 0,
        top20Count: 0,
        pricedCards: 0,
        topCards: [],
        history: history.get(r.id) ?? [],
      };
      bySet.set(r.id, s);
    }
    if (r.price == null) continue;
    s.pricedCards++;
    if (s.top20Count < 20) {
      s.top20Value += r.price;
      s.top20Count++;
      s.topCards.push({
        external_id: r.external_id,
        name: r.card_name,
        image_small: r.image_small,
        price: Math.round(r.price * 100) / 100,
      });
    }
  }
  return [...bySet.values()].map((s) => ({ ...s, top20Value: Math.round(s.top20Value * 100) / 100 }));
}

// Analyse "Pull Rates": alle Sets mit hinterlegten Pull Rates (von Hand
// gepflegt, siehe routes/sets.js) - das Frontend baut daraus die Matrix
// Seltenheit x Set.
const pullRateRowsStmt = db.prepare(`
  SELECT cs.id, cs.name, cs.series, cs.release_date, cs.chase_hit_rate_pct,
         pr.rarity, pr.any_denominator, pr.specific_denominator
  FROM card_sets cs
  LEFT JOIN pull_rates pr ON pr.set_id = cs.id
  WHERE cs.chase_hit_rate_pct IS NOT NULL OR pr.id IS NOT NULL
  ORDER BY cs.release_date DESC, cs.id
`);

export function getPullRateOverview() {
  const bySet = new Map();
  for (const r of pullRateRowsStmt.all()) {
    let s = bySet.get(r.id);
    if (!s) {
      s = { id: r.id, name: r.name, series: r.series, release_date: r.release_date, chaseHitRatePct: r.chase_hit_rate_pct, rarities: [] };
      bySet.set(r.id, s);
    }
    if (r.rarity) {
      s.rarities.push({ rarity: r.rarity, anyDenominator: r.any_denominator, specificDenominator: r.specific_denominator });
    }
  }
  return [...bySet.values()];
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
