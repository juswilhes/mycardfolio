import db from "../db/index.js";
import { priceHistoryForCard, latestTrend } from "./cardService.js";
import { slugOfSet } from "./setSlugs.js";

// Sets, deren Karten aus den Boostern eines anderen Sets gezogen werden: die
// Classic Collection steckt in den Boostern des 30th Celebration. In den
// Analysen zählt sie deshalb zum 30th Celebration (Pull Rates, Hit Rate,
// Top-20-Karten) und hat keine eigene Spalte/Zeile.
const BOOSTER_OF = { "30th-c": "30th" };
const boosterOf = (setId) => BOOSTER_OF[setId] ?? setId;
const setsInBooster = (setId) => [setId, ...Object.keys(BOOSTER_OF).filter((k) => BOOSTER_OF[k] === setId)];

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
    const cards = setsInBooster(r.id)
      .flatMap((id) => setCardsStmt.all(id))
      .map((c) => ({ ...c, price: latestTrend(c.id)?.price ?? null }))
      .filter((c) => c.price != null)
      .sort((a, b) => b.price - a.price);
    const top = cards.slice(0, 20);
    return {
      id: r.id,
      slug: slugOfSet(r.id),
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
    let s = bySet.get(b);
    if (!s) {
      s = { id: b, slug: slugOfSet(b), name: r.name, series: r.series, release_date: r.release_date, rarities: [] };
      bySet.set(b, s);
    }
    const own = r.id === b;
    if (own) Object.assign(s, { name: r.name, series: r.series, release_date: r.release_date });
    // Karten ohne Seltenheit ("None") gibt es nur in der Classic Collection
    const rarity = !own && r.rarity === "None" ? "Classic Collection" : r.rarity;
    s.rarities.push({ rarity, anyDenominator: r.any_denominator, specificDenominator: r.specific_denominator });
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

// Analyse "Wert pro Pack": erwarteter Wert eines Boosters aus den Pull Rates
// und den aktuellen Kartenpreisen. Pro Seltenheit mit hinterlegter Quote:
//   Summe der Preise aller Karten dieser Seltenheit / "diese 1/Y" (Quote pro Karte)
// bzw. ohne diese Quote: Durchschnittspreis / "jede 1/X". Alle Seltenheiten
// ohne hinterlegte Pull Rate (Common, Uncommon, Rare, Reverse Holo ...) sind
// NICHT enthalten - der Wert ist daher eine Untergrenze. Ein Display zählt
// als PACKS_PER_BOX Booster.
const PACKS_PER_BOX = 36;
const round2 = (x) => Math.round(x * 100) / 100;
const cardsWithRarityStmt = db.prepare(`SELECT id, rarity FROM cards WHERE set_id = ? AND rarity IS NOT NULL`);
const setPricesStmt = db.prepare(`SELECT box_price_cents, booster_price_cents FROM card_sets WHERE id = ?`);

// Pull-Rate-Zeilen je Booster (Sets in Fremd-Boostern zählen zum Booster-Set).
function boosterGroups() {
  const groups = new Map();
  for (const r of pullRateRowsStmt.all()) {
    const b = boosterOf(r.id);
    let g = groups.get(b);
    if (!g) {
      g = { id: b, name: r.name, series: r.series, release_date: r.release_date, rows: [] };
      groups.set(b, g);
    }
    if (r.id === b) Object.assign(g, { name: r.name, series: r.series, release_date: r.release_date });
    g.rows.push(r);
  }
  return [...groups.values()];
}

export function getPackValueAnalysis() {
  return boosterGroups().map((g) => {
    // Kartenpreise je Seltenheit (inkl. Karten aus Fremd-Boostern, z. B. Classic Collection)
    const byRarity = new Map();
    for (const setId of setsInBooster(g.id)) {
      for (const c of cardsWithRarityStmt.all(setId)) {
        const key = normRarity(c.rarity);
        let e = byRarity.get(key);
        if (!e) {
          e = { label: c.rarity, cards: 0, priced: 0, sum: 0 };
          byRarity.set(key, e);
        }
        e.cards++;
        const price = latestTrend(c.id)?.price;
        if (price != null) {
          e.priced++;
          e.sum += price;
        }
      }
    }

    let complete = true;
    const listed = new Set();
    const rarities = [];
    for (const r of g.rows) {
      const key = normRarity(r.rarity);
      listed.add(key);
      const e = byRarity.get(key);
      const own = r.id === g.id;
      const label = !own && r.rarity === "None" ? "Classic Collection" : r.rarity;
      let value = null;
      if (e?.priced) {
        if (r.specific_denominator) value = e.sum / r.specific_denominator;
        else if (r.any_denominator) value = e.sum / e.priced / r.any_denominator;
      }
      if (value == null) complete = false;
      rarities.push({
        rarity: label,
        cards: e?.cards ?? 0,
        pricedCards: e?.priced ?? 0,
        avgPrice: e?.priced ? round2(e.sum / e.priced) : null,
        anyDenominator: r.any_denominator,
        specificDenominator: r.specific_denominator,
        valuePerPack: value == null ? null : Math.round(value * 10000) / 10000,
      });
    }
    rarities.sort((a, b) => (b.valuePerPack ?? -1) - (a.valuePerPack ?? -1));

    const packValue = round2(rarities.reduce((s, r) => s + (r.valuePerPack ?? 0), 0));
    const prices = setPricesStmt.get(g.id) ?? {};
    return {
      id: g.id,
      slug: slugOfSet(g.id),
      name: g.name,
      series: g.series,
      release_date: g.release_date,
      packValue,
      complete,
      packsPerBox: PACKS_PER_BOX,
      boosterPriceCents: prices.booster_price_cents ?? null,
      boxPriceCents: prices.box_price_cents ?? null,
      rarities,
      notIncluded: [...byRarity.entries()].filter(([k]) => !listed.has(k)).map(([, e]) => e.label),
    };
  });
}

// Analyse "Set-Rangliste": Hit Rate, Wert pro Pack und Top-20-Wert je Set in
// einer Zeile - setzt nur die drei fertigen Auswertungen zusammen. Das
// Verhältnis zum Boosterpreis rechnet das Frontend.
export function buildSetRanking(setValue, pullRates, packValue) {
  const sets = new Map();
  const get = (id, base) => {
    if (!sets.has(id)) {
      sets.set(id, { id, slug: slugOfSet(id), name: base.name, release_date: base.release_date, hitRatePct: null, packValue: null, boosterPriceCents: null, top20Value: null, top20Count: 0, topCard: null });
    }
    return sets.get(id);
  };
  for (const s of pullRates) {
    Object.assign(get(s.id, s), { hitRatePct: s.hitRatePct, hitRateComplete: s.hitRateComplete });
  }
  for (const s of packValue) {
    Object.assign(get(s.id, s), { packValue: s.packValue, packComplete: s.complete, boosterPriceCents: s.boosterPriceCents });
  }
  for (const s of setValue) {
    const row = get(s.id, s);
    row.boosterPriceCents = s.boosterPriceCents ?? row.boosterPriceCents;
    Object.assign(row, { top20Value: s.top20Value, top20Count: s.top20Count });
    const top = s.topCards[0];
    row.topCard = top ? { external_id: top.external_id, name: top.name, price: top.price } : null;
  }
  // Nur Sets, für die die Pull Rates vorliegen - ohne sie ist kein fairer Vergleich möglich
  return [...sets.values()].filter((r) => r.hitRatePct != null || r.packValue != null);
}

// Analyse "Ziehen oder kaufen": je Set die Chase-Karten (Seltenheiten mit
// hinterlegter Quote pro Karte, ohne NO_HIT_RARITIES) mit aktuellem Preis. Wie
// viele Packs im Schnitt nötig sind und was das kostet, rechnet das Frontend
// (Quote x Boosterpreis), weil es vom Boosterpreis abhängt.
const cardsOfRarityStmt = db.prepare(
  `SELECT id, external_id, name, number, rarity, image_small FROM cards WHERE set_id = ? AND rarity IS NOT NULL`
);

export function getPullOrBuy() {
  return boosterGroups().map((g) => {
    const quotes = new Map();
    for (const r of g.rows) {
      const key = normRarity(r.rarity);
      if (NO_HIT_RARITIES.has(key) || !r.specific_denominator) continue;
      quotes.set(key, { denominator: r.specific_denominator, label: r.id === g.id || r.rarity !== "None" ? r.rarity : "Classic Collection" });
    }

    const cards = [];
    for (const setId of setsInBooster(g.id)) {
      for (const c of cardsOfRarityStmt.all(setId)) {
        const q = quotes.get(normRarity(c.rarity));
        const price = q ? latestTrend(c.id)?.price : null;
        if (price == null) continue;
        cards.push({
          external_id: c.external_id,
          name: c.name,
          number: c.number,
          image_small: c.image_small,
          rarity: q.label,
          price,
          specificDenominator: q.denominator,
        });
      }
    }
    cards.sort((a, b) => b.price - a.price);

    const prices = setPricesStmt.get(g.id) ?? {};
    return {
      id: g.id,
      name: g.name,
      release_date: g.release_date,
      boosterPriceCents: prices.booster_price_cents ?? null,
      packsPerBox: PACKS_PER_BOX,
      cards,
    };
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
// einmal täglich (Nachtlauf um 1 Uhr) - also bis zum nächsten Nachtlauf
// zwischenspeichern (analysisCache.js leert und füllt den Speicher neu).
const moversCache = new Map();
export const resetMoversCache = () => moversCache.clear();

// Größte Gewinner/Verlierer (Trendpreis, Variante 'normal') über alle
// Karten mit Preishistorie - unabhängig davon, wer sie besitzt.
// Optional auf ein Set eingeschränkt.
export function getMarketMovers({ days = 7, limit = 25, setName = null } = {}) {
  const key = `${days}|${limit}|${setName ?? ""}`;
  const hit = moversCache.get(key);
  if (hit) return hit.value;

  const cards = trackedCardsStmt.all().filter((c) => !setName || c.set_name === setName);
  const movers = cards
    .map((c) => moverFor(c, days))
    .filter((m) => m && !m.singlePoint && Math.abs(m.delta) >= 0.01 && m.previous)
    .filter(isPlausibleMove);

  const gainers = movers.filter((m) => m.delta > 0).sort((a, b) => b.delta_pct - a.delta_pct).slice(0, limit);
  const losers = movers.filter((m) => m.delta < 0).sort((a, b) => a.delta_pct - b.delta_pct).slice(0, limit);
  const value = { gainers, losers, trackedCount: movers.length };
  moversCache.set(key, { value });
  return value;
}
