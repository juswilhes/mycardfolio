import db from "../db/index.js";
import { recordPrices } from "./cardService.js";
import { cardmarketRows, AVG30_BAND } from "./priceProvider.js";
import { loadGuide, expansionOfProduct, resolveInExpansion } from "./cardmarketGuide.js";
import { rebuildAnalysisCache } from "./analysisCache.js";

// Der Hauptweg für die Nacht-Preise: Cardmarkets öffentliche Preisliste (eine Datei mit
// allen Produkten, täglich neu) statt ~20.000 Einzelabfragen bei TCGdex. Jede Karte
// bekommt ihr Cardmarket-Produkt aus unserer Datenbank (kam ursprünglich von TCGdex);
// wo das fehlt oder mehreren Karten desselben Sets zugeordnet ist, wird das richtige
// Produkt über Name + Angriffe gesucht (cardmarketGuide.js). Karten, die sich so nicht
// eindeutig zuordnen lassen, übernimmt weiter der Einzelabruf in priceFetcher.js.
const cardsStmt = db.prepare(`
  SELECT id, external_id, name, set_id, rarity, abilities, attacks,
         cardmarket_product_id AS pid, cardmarket_pid_locked AS locked, variant_flags, price_valid_from
  FROM cards WHERE game_id = (SELECT id FROM games WHERE slug = 'pokemon')
`);

// Gleiche Karte zweimal im Set (Justus 29.10.2026: Pikachu Cosmic Eclipse #66 Common und #241 Secret Rare,
// Vaporeon Skyridge #33 und H31): Cardmarket führt beide unter EXAKT demselben Namen, die Suche über Name +
// Angriffe findet also keinen eindeutigen Treffer, und TCGdex gibt oft beiden das teure Produkt. Folge waren
// falsch festgeschriebene Produkte (Pikachu Common 184 EUR) und Preise im Wechsel. Zuordnung hier: die
// gewöhnlichere Karte bekommt das günstigere Produkt - aber nur bei Common < Uncommon < Rare < Rare Holo
// (darüber stimmt die Reihenfolge nicht immer: Special Illustration Rare oft teurer als Mega Hyper Rare);
// bleibt danach genau eine seltenere Karte übrig, bekommt sie das letzte Produkt. Nur wenn alles eindeutig ist:
// gleich viele Produkte wie Karten, Trend, Tiefstpreis und 30-Tage-Schnitt in derselben Reihenfolge, jedes
// Produkt mind. 1,5x teurer als das vorige, und der TCGplayer-Wert der Karte widerspricht nicht.
// Geprüft am 29.10.2026 an 1.871 Karten gegen TCGplayer.
const BASE_RANK = { common: 1, uncommon: 2, rare: 3, "rare holo": 4 };
const lastTcgplayerStmt = db.prepare(`
  SELECT price FROM price_snapshots
  WHERE card_id = ? AND source = 'tcgplayer' AND price_type IN ('xcheck', 'xcheck_off') AND variant = 'normal'
    AND fetched_at >= COALESCE((SELECT price_valid_from FROM cards WHERE id = ?), '')
  ORDER BY fetched_at DESC LIMIT 1
`);
const norm = (s) => String(s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
const parseList = (json) => {
  try {
    return JSON.parse(json) ?? [];
  } catch {
    return [];
  }
};
const productSig = (name) => {
  const m = name.match(/^(.*?)\s*(?:\[(.*)\])?\s*$/);
  return `${norm(m[1])}|${(m[2] ?? "").split("|").map(norm).filter(Boolean).sort().join(",")}`;
};
const cardSig = (c) =>
  `${norm(c.name)}|${[...parseList(c.abilities), ...parseList(c.attacks)].map((a) => norm(a.name)).filter(Boolean).sort().join(",")}`;
const factor = (a, b) => Math.max(a, b) / Math.min(a, b);
const sameOrder = (a, b) => a.length === b.length && a.every((p, i) => p.id === b[i].id);

export function pairIdenticalProducts(guide, cards, setExpansion) {
  const groups = new Map();
  for (const c of cards) {
    const key = `${c.set_id}#${cardSig(c)}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(c);
  }
  const result = new Map();
  for (const [key, list] of groups) {
    if (list.length < 2) continue;
    const expansion = setExpansion.get(list[0].set_id);
    if (!expansion) continue;
    const sig = key.slice(key.indexOf("#") + 1);
    const products = (guide.byExpansion.get(expansion) ?? [])
      .filter((p) => productSig(p.name) === sig)
      .map((p) => ({ id: p.id, ...guide.prices.get(p.id) }))
      .filter((p) => p.trend > 0);
    if (products.length !== list.length) continue;

    const rarities = list.map((c) => (c.rarity ?? "").toLowerCase());
    if (rarities.some((r) => !r || r === "none" || r === "promo")) continue;
    const base = list.filter((c) => BASE_RANK[(c.rarity ?? "").toLowerCase()] != null);
    if (new Set(base.map((c) => c.rarity.toLowerCase())).size !== base.length) continue; // zwei gleiche Stufen: unklar
    // mehrere seltenere Karten: nur die gewöhnlichen bekommen die günstigsten Produkte, die anderen bleiben offen
    const rest = list.length - base.length;
    if (!base.length) continue;

    const byTrend = [...products].sort((a, b) => a.trend - b.trend);
    const byLow = products.filter((p) => p.low > 0).sort((a, b) => a.low - b.low);
    const byAvg = products.filter((p) => p.avg30 > 0).sort((a, b) => a.avg30 - b.avg30);
    if (!sameOrder(byTrend, byLow) || !sameOrder(byTrend, byAvg)) continue;
    if (!byTrend.every((p, i) => i === 0 || p.trend >= byTrend[i - 1].trend * 1.5)) continue;

    const sorted = [...base].sort((a, b) => BASE_RANK[a.rarity.toLowerCase()] - BASE_RANK[b.rarity.toLowerCase()]);
    const assign = sorted.map((c, i) => [c, byTrend[i]]);
    if (rest === 1) assign.push([list.find((c) => !base.includes(c)), byTrend[byTrend.length - 1]]);
    // Kaputter Eintrag bei Cardmarket (Blissey Aquapolis: Rare für 0,02 EUR): dann lieber gar nicht zuordnen
    if (assign.some(([c, p]) => BASE_RANK[(c.rarity ?? "").toLowerCase()] !== 1 && p.trend < 0.1)) continue;
    const veto = assign.some(([c, p]) => {
      const ref = lastTcgplayerStmt.get(c.id, c.id)?.price;
      return ref > 0 && factor(p.trend, ref) > 2.5 && byTrend.some((q) => q.id !== p.id && factor(q.trend, ref) <= 2.5);
    });
    if (veto) continue;
    for (const [c, p] of assign) result.set(c.id, p.id);
  }
  return result;
}

const relockStmt = db.prepare(`
  UPDATE cards SET cardmarket_pid_locked = ?, cardmarket_product_id = ?, cardmarket_pid_conflict = NULL WHERE id = ?
`);
// Produkt gewechselt: alle älteren Werte stammen vom falschen Produkt -> ausblenden (auch über ein früheres Datum hinweg)
const resetValidFromStmt = db.prepare(`UPDATE cards SET price_valid_from = ? WHERE id = ?`);

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

  // Gleiche Karte zweimal im Set: Zuordnung vorab festschreiben, auch über eine frühere (falsche) feste Zuordnung
  // hinweg; wechselt das Produkt, gelten die alten Werte nicht mehr (corrected -> price_valid_from)
  const pairs = pairIdenticalProducts(guide, cards, setExpansion);
  const changed = new Set();
  db.transaction(() => {
    for (const c of cards) {
      const pid = pairs.get(c.id);
      if (pid == null || c.locked === pid) continue;
      // neu: anderes Produkt als bisher, oder das Produkt war im Set geteilt (dann kamen die Werte über Umwege)
      if (c.locked != null || c.pid !== pid || uses.get(`${c.set_id}|${pid}`) > 1) {
        changed.add(c.id);
        resetValidFromStmt.run(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`, c.id);
      }
      relockStmt.run(pid, pid, c.id);
      c.locked = pid;
    }
  })();

  const stats = { gesetzt: 0, korrigiert: 0, offen: 0, festOhnePreis: 0, paare: pairs.size, paareUmgestellt: changed.size };
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
        recordPrices(c.id, rows, { basis: "cardmarket", productId: c.locked, updated: guide.updated, lockable: true, corrected: changed.has(c.id) });
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
      `${stats.festOhnePreis} fest zugeordnete heute ohne Preis. Gleiche Karte zweimal im Set: ${stats.paare} zugeordnet, ` +
      `${stats.paareUmgestellt} davon auf ein anderes Produkt umgestellt.`
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

// Einmalig (Marker price_band_history_v1): die gespeicherten Cardmarket-Werte der Vergangenheit auf dieselbe
// Grenze bringen wie robustPrice (±30 % um Ø 30 Tage desselben Tages), damit Graph und Preisbewegungen nicht
// die alten Ausreißer zeigen. An Tagen mit Gegenprobe (Mittel aus Cardmarket und TCGplayer) wird der
// Cardmarket-Anteil herausgerechnet, begrenzt und neu gemittelt. Vorher gesichert: nächtliche Sicherung.
export async function capHistoryToAvg30Band() {
  if (db.prepare(`SELECT value FROM app_meta WHERE key = 'price_band_history_v1'`).get()) return;
  // In Portionen zu 300 Karten mit Pause dazwischen: am Stück dauert das gut eine Minute, so lange wäre die Seite
  // sonst nicht erreichbar (better-sqlite3 arbeitet synchron)
  const rowsStmt = db.prepare(`
    SELECT t.id, t.price, a.price AS avg30,
      (SELECT x.price FROM price_snapshots x WHERE x.card_id = t.card_id AND x.variant = t.variant AND x.price_type = 'xcheck'
         AND substr(x.fetched_at, 1, 10) = substr(t.fetched_at, 1, 10) LIMIT 1) AS tcg
    FROM price_snapshots t
    JOIN price_snapshots a ON a.card_id = t.card_id AND a.variant = t.variant AND a.source = 'cardmarket'
      AND a.price_type = 'avg30' AND substr(a.fetched_at, 1, 10) = substr(t.fetched_at, 1, 10) AND a.price > 0
    WHERE t.card_id BETWEEN ? AND ? AND t.source = 'cardmarket' AND t.price_type = 'trend'
  `);
  const update = db.prepare(`UPDATE price_snapshots SET price = ? WHERE id = ?`);
  const clamp = (v, avg) => Math.min(Math.max(v, avg / AVG30_BAND), avg * AVG30_BAND);
  const maxId = db.prepare(`SELECT MAX(id) AS m FROM cards`).get().m ?? 0;
  let n = 0;
  for (let from = 0; from <= maxId; from += 300) {
    db.transaction(() => {
      for (const r of rowsStmt.all(from, from + 299)) {
        const cm = r.tcg > 0 ? 2 * r.price - r.tcg : r.price;
        if (!(cm > 0)) continue;
        const capped = clamp(cm, r.avg30);
        if (Math.abs(capped - cm) < 0.005) continue;
        update.run(Math.round((r.tcg > 0 ? (capped + r.tcg) / 2 : capped) * 100) / 100, r.id);
        n++;
      }
    })();
    await new Promise((r) => setTimeout(r, 20));
  }
  db.prepare(`INSERT OR REPLACE INTO app_meta (key, value) VALUES ('price_band_history_v1', ?)`).run(String(n));
  console.log(`[preisliste] ${n} gespeicherte Werte auf ±30 % um den 30-Tage-Schnitt begrenzt.`);
  rebuildAnalysisCache();
}

// Einmal nach dem Deploy im Hintergrund, damit die Preise nicht bis zum nächsten
// Nachtlauf warten müssen (Marker erst nach Abschluss gesetzt); danach macht das der
// Nachtlauf um 1 Uhr.
export function catchUpGuidePrices() {
  if (db.prepare(`SELECT value FROM app_meta WHERE key = 'guide_prices_v4'`).get()) return;
  setTimeout(async () => {
    try {
      await refreshPricesFromGuide();
      db.prepare(`INSERT OR REPLACE INTO app_meta (key, value) VALUES ('guide_prices_v4', '1')`).run();
      rebuildAnalysisCache();
    } catch (e) {
      console.error("[preisliste] Nachholen fehlgeschlagen (wird nachts erneut versucht):", e.message);
    }
  }, 45_000);
}
