import db from "../db/index.js";
import { loadGuide, expansionOfProduct } from "./cardmarketGuide.js";
import { robustPrice } from "./priceProvider.js";
import { slugOfSet } from "./setSlugs.js";

// Booster- und Displaypreise automatisch aus Cardmarkets öffentlicher Preisliste (Justus 29.10.2026), statt
// sie von Hand zu pflegen. Die versiegelten Produkte stehen in products_nonsingles_6.json, ihre Preise in
// derselben Preisliste wie die Karten. Die Cardmarket-Erweiterung eines Sets ist die häufigste unter den
// Produkten seiner Karten. Zuordnung nur bei eindeutigem Namen:
//  - Einzelbooster: "<Set> Booster" (kürzester solcher Name; nicht Sleeved, Fun Pack, "(6 Cards)" ...)
//  - Display: "<Set> Booster Box" (nicht "(18 Boosters)" = halbes Display, nicht Enhanced/Case). Sondersets
//    wie Prismatic Evolutions haben keins (nur Booster Bundles) - dort gilt nur der Boosterpreis.
// Ein Display muss 10- bis 80-mal so viel kosten wie ein Booster (36 Booster, alte Sets mit Aufpreis); sonst
// stimmt eins von beiden nicht (Expedition: Display 100 EUR, Booster 1.023 EUR) und das Set bleibt ohne
// automatischen Preis. Läuft nur im Nachtlauf (und einmal nach dem Deploy).
const BOOSTER_EXCLUDE = /sleeved|fun pack|sampling|dollar tree|demo|blister|jumbo|\(/i;
const DISPLAY_EXCLUDE = /enhanced|case|bundle|\(/i;
const MIN_RATIO = 10;
const MAX_RATIO = 80;

const cardProductsStmt = db.prepare(`
  SELECT set_id, COALESCE(cardmarket_pid_locked, cardmarket_product_id) AS pid
  FROM cards WHERE COALESCE(cardmarket_pid_locked, cardmarket_product_id) IS NOT NULL
`);
const setsStmt = db.prepare(`SELECT id, name FROM card_sets`);
const updateStmt = db.prepare(`
  UPDATE card_sets SET auto_box_price_cents = ?, auto_booster_price_cents = ?, auto_box_name = ?, auto_booster_name = ?,
    auto_prices_at = ? WHERE id = ?
`);

// Kürzester Name, der auf `suffix` endet - nur wenn er eindeutig der kürzeste ist
function pick(products, category, suffix, exclude) {
  const hits = products
    .filter((p) => p.category === category && p.name.endsWith(suffix) && !exclude.test(p.name))
    .sort((a, b) => a.name.length - b.name.length);
  if (!hits.length || (hits[1] && hits[1].name.length === hits[0].name.length)) return null;
  return hits[0];
}

const cents = (eur) => (eur > 0 ? Math.round(eur * 100) : null);

export async function refreshSealedPrices() {
  const guide = await loadGuide();

  // Erweiterung je Set (häufigste unter den Kartenprodukten) und wie viele Karten dafür sprechen
  const counts = new Map();
  for (const r of cardProductsStmt.all()) {
    const exp = expansionOfProduct(guide, r.pid);
    if (!exp) continue;
    const m = counts.get(r.set_id) ?? new Map();
    m.set(exp, (m.get(exp) ?? 0) + 1);
    counts.set(r.set_id, m);
  }
  const expansionOf = new Map();
  for (const [setId, m] of counts) {
    const [exp, n] = [...m].sort((a, b) => b[1] - a[1])[0];
    expansionOf.set(setId, { exp, n });
  }
  // Teilsets (Trainer Gallery, Shiny Vault ...) teilen sich die Erweiterung mit dem Hauptset: Preise nur bei EINEM
  // Set, sonst stünde derselbe Booster doppelt in der Liste. Vorrang hat das Set, dessen Name im Produktnamen steht
  // ("Shining Fates Booster" gehört zu Shining Fates, nicht zum größeren Teilset Shiny Vault), sonst das größte.
  const sets = setsStmt.all();
  const nameOf = new Map(sets.map((x) => [x.id, x.name]));
  const flat = (x) => String(x ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const owner = new Map();
  for (const [setId, { exp, n }] of expansionOf) {
    const names = (guide.sealedByExpansion?.get(exp) ?? []).map((p) => flat(p.name));
    const named = names.some((p) => p.startsWith(flat(nameOf.get(setId))) || p.startsWith(`ex${flat(nameOf.get(setId))}`));
    const cur = owner.get(exp);
    if (!cur || (named && !cur.named) || (named === cur.named && n > cur.n)) owner.set(exp, { setId, n, named });
  }

  const now = new Date().toISOString();
  const stats = { booster: 0, display: 0, unplausibel: 0 };
  db.transaction(() => {
    for (const { id } of sets) {
      const e = expansionOf.get(id);
      const products = e && owner.get(e.exp)?.setId === id ? guide.sealedByExpansion?.get(e.exp) ?? [] : [];
      const booster = pick(products, "Pokémon Booster", " Booster", BOOSTER_EXCLUDE);
      const display = pick(products, "Pokémon Display", " Booster Box", DISPLAY_EXCLUDE);
      let boosterCents = booster ? cents(robustPrice(guide.prices.get(booster.id) ?? {})) : null;
      let displayCents = display ? cents(robustPrice(guide.prices.get(display.id) ?? {})) : null;
      if (boosterCents && displayCents) {
        const ratio = displayCents / boosterCents;
        if (ratio < MIN_RATIO || ratio > MAX_RATIO) {
          boosterCents = displayCents = null;
          stats.unplausibel++;
        }
      }
      if (boosterCents) stats.booster++;
      if (displayCents) stats.display++;
      updateStmt.run(
        displayCents,
        boosterCents,
        displayCents ? display.name : null,
        boosterCents ? booster.name : null,
        boosterCents || displayCents ? now : null,
        id
      );
    }
  })();
  console.log(
    `[sealed] Cardmarket-Preise: ${stats.booster} Sets mit Booster-, ${stats.display} mit Displaypreis, ` +
      `${stats.unplausibel} unplausibel (ohne automatischen Preis).`
  );
  return stats;
}

// Für die Rubrik "Sealed" unter "Alle Karten": alle Sets mit automatischem Preis, neueste zuerst
const sealedListStmt = db.prepare(`
  SELECT id, name, series, release_date, logo, symbol, auto_booster_price_cents, auto_box_price_cents,
         auto_booster_name, auto_box_name, auto_prices_at
  FROM card_sets
  WHERE auto_booster_price_cents IS NOT NULL OR auto_box_price_cents IS NOT NULL
  ORDER BY release_date DESC
`);
const UTM = "utm_source=mycardfolio&utm_medium=referral";
// Cardmarket-Adressen lassen sich aus der Produktnummer nicht bauen (landet auf der Startseite) - Suche nach dem Namen
const searchLink = (name) =>
  name ? `https://www.cardmarket.com/de/Pokemon/Products/Search?searchString=${encodeURIComponent(name)}&${UTM}` : null;

export function listSealedPrices() {
  return sealedListStmt.all().map((s) => ({
    id: s.id,
    slug: slugOfSet(s.id),
    name: s.name,
    series: s.series,
    release_date: s.release_date,
    logo: s.logo ?? s.symbol,
    booster: s.auto_booster_price_cents
      ? { name: s.auto_booster_name, priceCents: s.auto_booster_price_cents, link: searchLink(s.auto_booster_name) }
      : null,
    display: s.auto_box_price_cents
      ? { name: s.auto_box_name, priceCents: s.auto_box_price_cents, link: searchLink(s.auto_box_name) }
      : null,
    updated: s.auto_prices_at,
  }));
}

// Einmal nach dem Deploy (Marker), damit die Preise nicht erst nach dem nächsten Nachtlauf da sind
export function catchUpSealedPrices(after) {
  if (db.prepare(`SELECT value FROM app_meta WHERE key = 'sealed_prices_v1'`).get()) return;
  setTimeout(async () => {
    try {
      await refreshSealedPrices();
      db.prepare(`INSERT OR REPLACE INTO app_meta (key, value) VALUES ('sealed_prices_v1', '1')`).run();
      after?.();
    } catch (e) {
      console.error("[sealed] Nachholen fehlgeschlagen (wird nachts erneut versucht):", e.message);
    }
  }, 60_000);
}
