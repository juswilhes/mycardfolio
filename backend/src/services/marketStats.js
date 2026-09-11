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

const trackedSetsStmt = db.prepare(`
  SELECT DISTINCT c.set_name
  FROM cards c
  JOIN price_snapshots ps ON ps.card_id = c.id
  WHERE c.set_name IS NOT NULL
  ORDER BY c.set_name
`);

const watchlistCardsStmt = db.prepare(`
  SELECT c.id, c.external_id, c.name, c.set_name, c.image_small
  FROM watchlist_items wi
  JOIN cards c ON c.id = wi.card_id
  WHERE wi.user_id = ?
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

// Set-Namen, für die wir mindestens eine beobachtete Karte haben - fürs
// Filter-Dropdown der Marktübersicht.
export function getTrackedSets() {
  return trackedSetsStmt.all().map((r) => r.set_name);
}

// Größte Gewinner/Verlierer (Trendpreis, Variante 'normal') über alle
// jemals angesehenen Karten - unabhängig davon, wer sie besitzt. Wächst mit
// der Zeit, je mehr Karten Nutzer sich ansehen (siehe priceFetcher.js).
// Optional auf ein Set eingeschränkt.
export function getMarketMovers({ days = 7, limit = 25, setName = null } = {}) {
  const cards = trackedCardsStmt.all().filter((c) => !setName || c.set_name === setName);
  const movers = cards
    .map((c) => moverFor(c, days))
    .filter((m) => m && !m.singlePoint && Math.abs(m.delta) >= 0.01 && m.previous);

  const gainers = movers.filter((m) => m.delta > 0).sort((a, b) => b.delta_pct - a.delta_pct).slice(0, limit);
  const losers = movers.filter((m) => m.delta < 0).sort((a, b) => a.delta_pct - b.delta_pct).slice(0, limit);
  return { gainers, losers, trackedCount: movers.length };
}

// Preisstatus aller Karten auf der eigenen Watchlist - nicht nur die
// größten Ausschläge, sondern die ganze Liste, damit man auf einen Blick
// sieht, was sich bei den beobachteten Karten gerade tut.
export function getWatchlistMovers(userId, { days = 7 } = {}) {
  const movers = watchlistCardsStmt
    .all(userId)
    .map((c) => moverFor(c, days))
    .filter(Boolean);
  movers.sort((a, b) => b.delta_pct - a.delta_pct);
  return movers;
}

// Durchschnittliche Bewegung je Set ("welche Sets sind gerade heiß/kalt") -
// nur Sets mit mindestens minCards beobachteten Karten, damit ein einzelner
// Ausreißer nicht ein ganzes Set aussehen lässt, als würde es sich bewegen.
export function getSetMomentum({ days = 30, minCards = 3, limit = 8 } = {}) {
  const bySet = new Map();
  for (const c of trackedCardsStmt.all()) {
    if (!c.set_name) continue;
    const m = moverFor(c, days);
    if (!m || m.singlePoint || !m.previous) continue;
    if (!bySet.has(c.set_name)) bySet.set(c.set_name, []);
    bySet.get(c.set_name).push(m.delta_pct);
  }

  const sets = [...bySet.entries()]
    .filter(([, pcts]) => pcts.length >= minCards)
    .map(([set_name, pcts]) => ({
      set_name,
      avg_pct: pcts.reduce((s, p) => s + p, 0) / pcts.length,
      cardCount: pcts.length,
    }));

  const rising = sets.filter((s) => s.avg_pct > 0).sort((a, b) => b.avg_pct - a.avg_pct).slice(0, limit);
  const falling = sets.filter((s) => s.avg_pct < 0).sort((a, b) => a.avg_pct - b.avg_pct).slice(0, limit);
  return { rising, falling };
}

// "Thawing": Karten, die über einen langen Zeitraum deutlich gefallen sind,
// sich zuletzt (7 Tage) aber wieder nach oben drehen - frühes Signal für
// eine mögliche Trendwende.
export function getThawing({ longDays = 120, shortDays = 7, limit = 15 } = {}) {
  const result = [];
  for (const c of trackedCardsStmt.all()) {
    const long = moverFor(c, longDays);
    const short = moverFor(c, shortDays);
    if (!long || !short || long.singlePoint || short.singlePoint || !long.previous) continue;
    if (long.delta_pct <= -10 && short.delta_pct > 0) {
      result.push({
        card_id: c.id,
        external_id: c.external_id,
        name: c.name,
        set_name: c.set_name,
        image_small: c.image_small,
        current: short.current,
        longTermPct: long.delta_pct,
        recentPct: short.delta_pct,
      });
    }
  }
  result.sort((a, b) => b.recentPct - a.recentPct);
  return result.slice(0, limit);
}
