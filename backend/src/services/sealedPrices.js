import db from "../db/index.js";
import { loadGuide, expansionOfProduct } from "./cardmarketGuide.js";
import { robustPrice, usdToEur } from "./priceProvider.js";

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
//
// Mittelwert mit TCGplayer (Justus 29.10.2026): Cardmarkets Liste mittelt über alle Sprachen, englische Displays
// kosten mehr (Mega Evolution: Cardmarket 209 EUR, englisch ca. 280 EUR). TCGplayer (USA) führt nur englische
// Produkte. Gilt jetzt (Cardmarket + TCGplayer) / 2, wenn TCGplayer das Produkt hat und höchstens 2,5x abweicht,
// sonst Cardmarket allein. TCGplayer-Daten von tcgcsv.com (freier Tagesabzug der TCGplayer-Daten; Regeln:
// eigene Kennung im User-Agent, einmal am Tag, mit Pause, Daten selbst speichern - https://tcgcsv.com/docs).
const BOOSTER_EXCLUDE = /sleeved|fun pack|sampling|dollar tree|demo|blister|jumbo|\(/i;
const DISPLAY_EXCLUDE = /enhanced|case|bundle|\(/i;
const TCG_MAX_FACTOR = 2.5;
const TCGCSV = "https://tcgcsv.com/tcgplayer/3"; // 3 = Pokémon
const UA = { "User-Agent": "mycardfolio/1.0 (+https://mycardfolio.de)" };
const MIN_RATIO = 10;
const MAX_RATIO = 80;

const cardProductsStmt = db.prepare(`
  SELECT set_id, COALESCE(cardmarket_pid_locked, cardmarket_product_id) AS pid
  FROM cards WHERE COALESCE(cardmarket_pid_locked, cardmarket_product_id) IS NOT NULL
`);
const setsStmt = db.prepare(`SELECT id, name FROM card_sets`);
const updateStmt = db.prepare(`
  UPDATE card_sets SET auto_box_price_cents = ?, auto_booster_price_cents = ?, auto_box_name = ?, auto_booster_name = ?,
    auto_prices_at = ?, auto_box_cm_cents = ?, auto_box_tcg_cents = ?, auto_booster_cm_cents = ?, auto_booster_tcg_cents = ?
  WHERE id = ?
`);

// TCGplayer-Gruppe (= Set) zu unserem Set: Namen ohne Kürzel ("SV02: ", "SM - ", "EX "), "Base Set" am Ende und
// "&"/"and" gleich behandelt; Sonderfälle mit festem Namen
const TCG_GROUP_ALIAS = { base1: "Base Set", sm1: "SM Base Set", sv3pt5: "SV: Scarlet & Violet 151" };
const groupKey = (name) => {
  let n = String(name ?? "")
    .replace(/^[A-Za-z0-9 .]+:\s*/, "")
    .replace(/^(SM|XY|SWSH|SV|BW|DP|HGSS|ME)\s+-\s+/i, "")
    .replace(/^EX\s+/i, "")
    .replace(/^HS\W+/i, "");
  const stripped = n.replace(/\s+Base Set$/i, "");
  if (stripped) n = stripped;
  return n.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]/g, "");
};

async function tcgJson(path) {
  await new Promise((r) => setTimeout(r, 250)); // Pause zwischen den Abrufen (Regeln von tcgcsv)
  const res = await fetch(`${TCGCSV}${path}`, { headers: UA, signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`tcgcsv ${path}: HTTP ${res.status}`);
  return (await res.json()).results ?? [];
}

// Kürzester Name mit dieser Endung, nur wenn eindeutig
function pickTcg(products, suffix, exclude) {
  const hits = products.filter((p) => p.name.endsWith(suffix) && !exclude.test(p.name)).sort((a, b) => a.name.length - b.name.length);
  if (!hits.length || (hits[1] && hits[1].name.length === hits[0].name.length)) return null;
  return hits[0];
}
const TCG_BOOSTER_EXCLUDE = /sleeved|code card|blister|art bundle|bundle|case/i;
const TCG_DISPLAY_EXCLUDE = /enhanced|case|half|bundle/i;

// { setId: { boosterEur, displayEur } } aus TCGplayer (Marktpreis, USD -> EUR) für die genannten Sets
async function tcgplayerPrices(sets) {
  const out = new Map();
  let groups;
  try {
    groups = await tcgJson("/groups");
  } catch (e) {
    console.warn("[sealed] TCGplayer (tcgcsv) nicht erreichbar, nur Cardmarket:", e.message);
    return out;
  }
  const rate = await usdToEur();
  for (const s of sets) {
    const alias = TCG_GROUP_ALIAS[s.id];
    const hits = groups.filter((g) => (alias ? g.name === alias : groupKey(g.name) === groupKey(s.name)));
    if (hits.length !== 1) continue;
    try {
      const [products, prices] = [await tcgJson(`/${hits[0].groupId}/products`), await tcgJson(`/${hits[0].groupId}/prices`)];
      const market = new Map(prices.filter((p) => p.marketPrice > 0).map((p) => [p.productId, p.marketPrice]));
      const booster = pickTcg(products, " Booster Pack", TCG_BOOSTER_EXCLUDE);
      const display = pickTcg(products, " Booster Box", TCG_DISPLAY_EXCLUDE);
      const eur = (p) => (p && market.get(p.productId) ? market.get(p.productId) * rate : null);
      out.set(s.id, { boosterEur: eur(booster), displayEur: eur(display) });
    } catch (e) {
      console.warn(`[sealed] TCGplayer ${s.name}: ${e.message}`);
    }
  }
  return out;
}

// Mittelwert aus Cardmarket und TCGplayer, wenn beide da sind und zusammenpassen; sonst Cardmarket
function blend(cmCents, tcgEur) {
  const tcgCents = cents(tcgEur);
  if (!cmCents || !tcgCents) return { value: cmCents, tcg: null };
  const f = Math.max(cmCents, tcgCents) / Math.min(cmCents, tcgCents);
  if (f > TCG_MAX_FACTOR) return { value: cmCents, tcg: null };
  return { value: Math.round((cmCents + tcgCents) / 2), tcg: tcgCents };
}

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

  // Erst Cardmarket je Set bestimmen, dann TCGplayer nur für Sets mit Cardmarket-Preis abrufen (gemittelt wird nur dort)
  const cm = new Map();
  const stats = { booster: 0, display: 0, unplausibel: 0, mitTcgplayer: 0 };
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
    cm.set(id, { booster, display, boosterCents, displayCents });
  }
  const tcg = await tcgplayerPrices(sets.filter((s) => cm.get(s.id)?.boosterCents || cm.get(s.id)?.displayCents));

  const now = new Date().toISOString();
  db.transaction(() => {
    for (const { id } of sets) {
      const { booster, display, boosterCents, displayCents } = cm.get(id);
      const t = tcg.get(id) ?? {};
      const b = blend(boosterCents, t.boosterEur);
      const d = blend(displayCents, t.displayEur);
      if (b.value) stats.booster++;
      if (d.value) stats.display++;
      if (b.tcg || d.tcg) stats.mitTcgplayer++;
      updateStmt.run(
        d.value,
        b.value,
        d.value ? display.name : null,
        b.value ? booster.name : null,
        b.value || d.value ? now : null,
        displayCents,
        d.tcg,
        boosterCents,
        b.tcg,
        id
      );
    }
  })();
  console.log(
    `[sealed] ${stats.booster} Sets mit Booster-, ${stats.display} mit Displaypreis (${stats.mitTcgplayer} davon mit TCGplayer gemittelt), ` +
      `${stats.unplausibel} unplausibel (ohne automatischen Preis).`
  );
  return stats;
}

// Für die Set-Seite (oben, über den Einzelkarten): Booster- und Displaypreis dieses Sets
const sealedOfSetStmt = db.prepare(`
  SELECT auto_booster_price_cents, auto_box_price_cents, auto_booster_name, auto_box_name, auto_prices_at,
         auto_box_cm_cents, auto_box_tcg_cents, auto_booster_cm_cents, auto_booster_tcg_cents
  FROM card_sets WHERE id = ?
`);
const UTM = "utm_source=mycardfolio&utm_medium=referral";
// Cardmarket-Adressen lassen sich aus der Produktnummer nicht bauen (landet auf der Startseite) - Suche nach dem Namen
const searchLink = (name) =>
  name ? `https://www.cardmarket.com/de/Pokemon/Products/Search?searchString=${encodeURIComponent(name)}&${UTM}` : null;
const item = (name, priceCents, cardmarketCents, tcgplayerCents) =>
  priceCents ? { name, priceCents, cardmarketCents, tcgplayerCents, link: searchLink(name) } : null;

export function sealedForSet(setId) {
  const s = sealedOfSetStmt.get(setId);
  if (!s || !(s.auto_booster_price_cents || s.auto_box_price_cents)) return null;
  return {
    booster: item(s.auto_booster_name, s.auto_booster_price_cents, s.auto_booster_cm_cents, s.auto_booster_tcg_cents),
    display: item(s.auto_box_name, s.auto_box_price_cents, s.auto_box_cm_cents, s.auto_box_tcg_cents),
    updated: s.auto_prices_at,
  };
}

// Einmal nach dem Deploy (Marker), damit die Preise nicht erst nach dem nächsten Nachtlauf da sind
export function catchUpSealedPrices(after) {
  if (db.prepare(`SELECT value FROM app_meta WHERE key = 'sealed_prices_v2'`).get()) return;
  setTimeout(async () => {
    try {
      await refreshSealedPrices();
      db.prepare(`INSERT OR REPLACE INTO app_meta (key, value) VALUES ('sealed_prices_v2', '1')`).run();
      after?.();
    } catch (e) {
      console.error("[sealed] Nachholen fehlgeschlagen (wird nachts erneut versucht):", e.message);
    }
  }, 60_000);
}
