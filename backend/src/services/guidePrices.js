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
         cardmarket_product_id AS pid, cardmarket_pid_locked AS locked, variant_flags, price_valid_from
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

  const stats = { gesetzt: 0, korrigiert: 0, offen: 0, festOhnePreis: 0 };
  db.transaction(() => {
    for (const c of cards) {
      // Feste Zuordnung: kein Neu-Suchen, kein Einzelabruf - fehlt das Produkt heute in der Liste, bleibt der Tag leer
      if (c.locked != null) {
        const row = guide.prices.get(c.locked);
        const flags = c.variant_flags ? JSON.parse(c.variant_flags) : null;
        const rows = row ? cardmarketRows(row, flags?.reverse ? "reverse" : "holo") : [];
        if (!rows.length) {
          stats.festOhnePreis++;
          continue;
        }
        recordPrices(c.id, rows, { basis: "cardmarket", productId: c.locked, updated: guide.updated, lockable: true });
        stats.gesetzt++;
        continue;
      }
      let pid = c.pid;
      const shared = pid && uses.get(`${c.set_id}|${pid}`) > 1;
      let corrected = false;
      // Sicher (darf festgeschrieben werden): eigenes, im Set eindeutiges Produkt einer nie korrigierten Karte
      // oder ein EINDEUTIGER Treffer über Name + Angriffe. Geraten (ältestes passendes Produkt) ist nicht sicher.
      let sure = !!pid && !shared && !c.price_valid_from;

      if (!pid || shared || c.price_valid_from) {
        const expansion = (pid && expansionOfProduct(guide, pid)) || setExpansion.get(c.set_id);
        const unique = resolveInExpansion(guide, c, expansion);
        const hit = unique ?? (!pid ? resolveInExpansion(guide, c, expansion, { preferOldest: true }) : null);
        if (hit) {
          pid = hit.idProduct;
          corrected = !!(shared || c.price_valid_from);
          sure = !!unique;
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
      // Eine geratene Zuordnung (Karte ohne Produkt, ältestes passendes genommen) wird nicht gespeichert: sonst gilt
      // das Produkt in der nächsten Nacht als "geteilt", die Karte fällt durch - und das im Zwei-Tage-Takt (Darkrai-EX).
      const guessed = !c.pid && !sure;
      recordPrices(c.id, rows, { basis: "cardmarket", productId: guessed ? null : pid, updated: guide.updated, corrected, lockable: sure });
      stats.gesetzt++;
      if (corrected) stats.korrigiert++;
    }
  })();

  console.log(
    `[preisliste] ${stats.gesetzt} Karten bepreist (${stats.korrigiert} davon korrigiert), ${stats.offen} für den Einzelabruf übrig, ` +
      `${stats.festOhnePreis} fest zugeordnete heute ohne Preis.`
  );
  return stats;
}

// Einmalig (Marker price_wobbly_cleanup_v1): Karten, deren Cardmarket-Reihe in den letzten 3 Wochen
// mehrfach über Faktor 2,5 gesprungen ist (wechselnde Produkt-Zuordnung), zeigen ihre bisherigen Werte
// nicht mehr - ab dem nächsten Nachtlauf beginnt die Reihe mit der festen Zuordnung neu.
export function cleanUpWobblySeries() {
  if (db.prepare(`SELECT value FROM app_meta WHERE key = 'price_wobbly_cleanup_v1'`).get()) return;
  const rows = db.prepare(`
    SELECT card_id, price FROM price_snapshots
    WHERE source = 'cardmarket' AND price_type = 'trend' AND variant = 'normal' AND fetched_at > datetime('now', '-21 days')
    ORDER BY card_id, fetched_at
  `).all();
  const wobbly = [];
  let prev = null;
  let jumps = 0;
  for (const r of [...rows, { card_id: null }]) {
    if (!prev || r.card_id !== prev.card_id) {
      if (prev && jumps >= 2) wobbly.push(prev.card_id);
      jumps = 0;
    } else if (prev.price > 0.5 && r.price > 0.5 && Math.max(prev.price / r.price, r.price / prev.price) > 2.5) {
      jumps++;
    }
    prev = r;
  }
  const now = new Date().toISOString();
  const mark = db.prepare(`UPDATE cards SET price_valid_from = ? WHERE id = ? AND (price_valid_from IS NULL OR price_valid_from < ?)`);
  db.transaction(() => {
    for (const id of wobbly) mark.run(now, id, now);
    db.prepare(`INSERT OR REPLACE INTO app_meta (key, value) VALUES ('price_wobbly_cleanup_v1', ?)`).run(String(wobbly.length));
  })();
  console.log(`[preisliste] ${wobbly.length} wackelige Preisreihen neu begonnen (Altwerte ausgeblendet).`);
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
