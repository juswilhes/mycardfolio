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

// Größte Gewinner/Verlierer (Trendpreis, Variante 'normal') über alle
// jemals angesehenen Karten - unabhängig davon, wer sie besitzt. Wächst mit
// der Zeit, je mehr Karten Nutzer sich ansehen (siehe priceFetcher.js).
export function getMarketMovers({ days = 7, limit = 25 } = {}) {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  const movers = [];

  for (const c of trackedCardsStmt.all()) {
    const hist = priceHistoryForCard.all(c.id);
    if (hist.length < 2) continue;

    const latest = hist[hist.length - 1];
    let base = hist[0];
    for (const h of hist) {
      if (new Date(h.fetched_at).getTime() <= cutoff) base = h;
      else break;
    }
    if (base === latest) continue;

    const delta = latest.price - base.price;
    if (Math.abs(delta) < 0.01 || !base.price) continue;

    movers.push({
      card_id: c.id,
      external_id: c.external_id,
      name: c.name,
      set_name: c.set_name,
      image_small: c.image_small,
      current: latest.price,
      previous: base.price,
      delta,
      delta_pct: (delta / base.price) * 100,
      since: base.fetched_at,
    });
  }

  const gainers = movers.filter((m) => m.delta > 0).sort((a, b) => b.delta_pct - a.delta_pct).slice(0, limit);
  const losers = movers.filter((m) => m.delta < 0).sort((a, b) => a.delta_pct - b.delta_pct).slice(0, limit);
  return { gainers, losers, trackedCount: movers.length };
}
