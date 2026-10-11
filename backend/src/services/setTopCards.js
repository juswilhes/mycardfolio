import db from "../db/index.js";
import { latestTrend } from "./cardService.js";
import { slugOfCard } from "./cardSlugs.js";

// Die wertvollsten Karten je Set (für den sichtbaren Text der Set-Seiten, siehe seo.js - "wertvollste
// Karten aus <Set>" ist eine typische Suchanfrage). Wird nur im Nachtlauf gerechnet (analysisCache.js):
// erst eine schnelle Vorauswahl über den letzten Cardmarket-Wert aller Karten, dann der genaue Preis
// (latestTrend, derselbe wie auf der Kartenseite) nur für die Top-25 je Set.
const allCardsStmt = db.prepare(`
  SELECT c.id, c.set_id, c.external_id, c.name, c.name_de,
    (SELECT s.price FROM price_snapshots s
      WHERE s.card_id = c.id AND s.price_type = 'trend' AND s.source = 'cardmarket'
      ORDER BY s.fetched_at DESC LIMIT 1) AS p
  FROM cards c WHERE c.game_id = (SELECT id FROM games WHERE slug = 'pokemon')
`);

export function getSetTopCards() {
  const bySet = new Map();
  for (const r of allCardsStmt.all()) {
    if (r.p == null) continue;
    if (!bySet.has(r.set_id)) bySet.set(r.set_id, []);
    bySet.get(r.set_id).push(r);
  }
  const out = {};
  for (const [setId, rows] of bySet) {
    out[setId] = rows
      .sort((a, b) => b.p - a.p)
      .slice(0, 25)
      .map((r) => ({ r, t: latestTrend(r.id) }))
      .filter((x) => x.t?.price != null)
      .sort((a, b) => b.t.price - a.t.price)
      .slice(0, 10)
      .map(({ r, t }) => ({
        slug: slugOfCard(r.external_id),
        name: r.name_de && r.name_de !== r.name ? `${r.name_de} (${r.name})` : r.name,
        price: t.price,
      }));
  }
  return out;
}
