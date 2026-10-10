import db from "../db/index.js";
import { recordPrices } from "./cardService.js";
import { cardmarketRows } from "./priceProvider.js";
import { loadGuide, expansionOfProduct, resolveInExpansion } from "./cardmarketGuide.js";
import { rebuildAnalysisCache } from "./analysisCache.js";

// Der Hauptweg für die Nacht-Preise: Cardmarkets öffentliche Preisliste (eine Datei mit
// allen Produkten, täglich neu) statt ~20.000 Einzelabfragen bei TCGdex. Jede Karte
// bekommt ihr Cardmarket-Produkt aus unserer Datenbank (kam ursprünglich von TCGdex);
// wo das fehlt oder mehreren Karten desselben Sets zugeordnet ist, wird das richtige
// Produkt über Name + Angriffe gesucht (cardmarketGuide.js). Karten, die sich so nicht
// eindeutig zuordnen lassen, übernimmt weiter der Einzelabruf in priceFetcher.js.
const cardsStmt = db.prepare(`
  SELECT id, external_id, name, set_id, abilities, attacks,
         cardmarket_product_id AS pid, variant_flags, price_valid_from
  FROM cards WHERE game_id = (SELECT id FROM games WHERE slug = 'pokemon')
`);

export async function refreshPricesFromGuide() {
  const guide = await loadGuide();
  const cards = cardsStmt.all();

  // Wie oft kommt ein Produkt in einem Set vor? (>1 = TCGdex hat es mehrfach vergeben)
  const uses = new Map();
  // Erweiterung je Set = die häufigste unter den Produkten seiner Karten
  const expCounts = new Map();
  for (const c of cards) {
    if (!c.pid) continue;
    const key = `${c.set_id}|${c.pid}`;
    uses.set(key, (uses.get(key) ?? 0) + 1);
    const exp = expansionOfProduct(guide, c.pid);
    if (!exp) continue;
    const m = expCounts.get(c.set_id) ?? new Map();
    m.set(exp, (m.get(exp) ?? 0) + 1);
    expCounts.set(c.set_id, m);
  }
  const setExpansion = new Map(
    [...expCounts].map(([setId, m]) => [setId, [...m].sort((a, b) => b[1] - a[1])[0][0]])
  );

  const stats = { gesetzt: 0, korrigiert: 0, offen: 0 };
  db.transaction(() => {
    for (const c of cards) {
      let pid = c.pid;
      const shared = pid && uses.get(`${c.set_id}|${pid}`) > 1;
      let corrected = false;

      if (!pid || shared || c.price_valid_from) {
        const expansion = (pid && expansionOfProduct(guide, pid)) || setExpansion.get(c.set_id);
        const hit = resolveInExpansion(guide, c, expansion, { preferOldest: !pid });
        if (hit) {
          pid = hit.idProduct;
          corrected = !!(shared || c.price_valid_from);
        } else if (shared || !pid) {
          stats.offen++; // nicht eindeutig: Einzelabruf (TCGdex / pokemontcg.io)
          continue;
        }
      }

      const row = guide.prices.get(pid);
      const flags = c.variant_flags ? JSON.parse(c.variant_flags) : null;
      const rows = row ? cardmarketRows(row, flags?.reverse ? "reverse" : "holo") : [];
      if (!rows.length) {
        stats.offen++;
        continue;
      }
      recordPrices(c.id, rows, { basis: "cardmarket", productId: pid, updated: guide.updated, corrected });
      stats.gesetzt++;
      if (corrected) stats.korrigiert++;
    }
  })();

  console.log(`[preisliste] ${stats.gesetzt} Karten bepreist (${stats.korrigiert} davon korrigiert), ${stats.offen} für den Einzelabruf übrig.`);
  return stats;
}

// Einmal nach dem Deploy im Hintergrund, damit die Preise nicht bis zum nächsten
// Nachtlauf warten müssen (Marker erst nach Abschluss gesetzt); danach macht das der
// Nachtlauf um 1 Uhr.
export function catchUpGuidePrices() {
  if (db.prepare(`SELECT value FROM app_meta WHERE key = 'guide_prices_v3'`).get()) return;
  setTimeout(async () => {
    try {
      await refreshPricesFromGuide();
      db.prepare(`INSERT OR REPLACE INTO app_meta (key, value) VALUES ('guide_prices_v3', '1')`).run();
      rebuildAnalysisCache();
    } catch (e) {
      console.error("[preisliste] Nachholen fehlgeschlagen (wird nachts erneut versucht):", e.message);
    }
  }, 45_000);
}
