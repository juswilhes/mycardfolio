import db from "../db/index.js";
import { loadGuide } from "./cardmarketGuide.js";
import { robustPrice, usdToEur } from "./priceProvider.js";
import { sealedExpansions, groupKey, tcgJson, TCG_GROUP_ALIAS, searchLink } from "./sealedPrices.js";

// Katalog der versiegelten Produkte je Set (Justus 08.11.2026: "Sealed-Produkte über die Cardmarket- und
// TCGplayer-Infos hinzufügen"): Auswahl mit Bild beim Hinzufügen statt Handeingabe, Wert automatisch jede Nacht.
// Produktliste und Bilder von TCGplayer (tcgcsv.com, alles außer Einzelkarten, Cases und Code Cards), Cardmarket-
// Gegenstück über den gleichen Namen in der Erweiterung des Sets (nur eindeutig). Wert wie bei Booster/Display
// (sealedPrices.js): Mittelwert aus Cardmarket und TCGplayer, wenn beide da sind und höchstens 2,5x auseinander;
// sonst Cardmarket, ohne Cardmarket-Gegenstück TCGplayer allein.
const MAX_FACTOR = 2.5;
const EXCLUDE = /\bcase\b|code card/i;

const setsStmt = db.prepare(`SELECT id, name FROM card_sets`);
const upsertStmt = db.prepare(`
  INSERT INTO sealed_catalog (set_id, tcg_product_id, name, image, cm_product_id, cm_name, cm_cents, tcg_cents, price_cents, updated_at)
  VALUES (@set_id, @tcg_product_id, @name, @image, @cm_product_id, @cm_name, @cm_cents, @tcg_cents, @price_cents, @updated_at)
  ON CONFLICT(tcg_product_id) DO UPDATE SET
    set_id = excluded.set_id, name = excluded.name, image = excluded.image, cm_product_id = excluded.cm_product_id,
    cm_name = excluded.cm_name, cm_cents = excluded.cm_cents, tcg_cents = excluded.tcg_cents,
    price_cents = excluded.price_cents, updated_at = excluded.updated_at
`);

// "Delta Reign Booster Pack" (TCGplayer) = "Delta Reign Booster" (Cardmarket); Akzente und Satzzeichen egal.
// Erst mit, dann ohne Klammerzusatz vergleichen: sonst fielen "Booster Box" und "Booster Box (18 Boosters)" zusammen
// und das Display bekäme keinen Cardmarket-Wert (anderer Preis als oben auf der Set-Seite).
const nameKey = (s, loose = false) => {
  let n = String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  if (loose) n = n.replace(/\(.*?\)|\[.*?\]/g, "");
  return n.replace(/\bpack\b/g, "").replace(/[^a-z0-9]/g, "");
};
// Schlüssel -> Produkt, nur wenn er genau einmal vorkommt (sonst null)
const uniqueBy = (list, key) => {
  const m = new Map();
  for (const p of list) m.set(key(p.name), m.has(key(p.name)) ? null : p);
  return m;
};
const cents = (eur) => (eur > 0 ? Math.round(eur * 100) : null);

function blend(cmCents, tcgCents) {
  if (cmCents && tcgCents) {
    return Math.max(cmCents, tcgCents) / Math.min(cmCents, tcgCents) <= MAX_FACTOR ? Math.round((cmCents + tcgCents) / 2) : cmCents;
  }
  return cmCents ?? tcgCents ?? null;
}

export async function refreshSealedCatalog() {
  const guide = await loadGuide();
  const expansions = sealedExpansions(guide);
  const groups = await tcgJson("/groups");
  const rate = await usdToEur();
  const now = new Date().toISOString();
  const stats = { sets: 0, produkte: 0, mitCardmarket: 0, mitPreis: 0 };

  for (const s of setsStmt.all()) {
    const alias = TCG_GROUP_ALIAS[s.id];
    const hits = groups.filter((g) => (alias ? g.name === alias : groupKey(g.name) === groupKey(s.name)));
    if (hits.length !== 1) continue;
    let products;
    let prices;
    try {
      products = (await tcgJson(`/${hits[0].groupId}/products`)).filter(
        (p) => !(p.extendedData ?? []).some((e) => e.name === "Number") && !EXCLUDE.test(p.name)
      );
      if (!products.length) continue;
      prices = await tcgJson(`/${hits[0].groupId}/prices`);
    } catch (e) {
      console.warn(`[sealed-katalog] ${s.name}: ${e.message}`);
      continue;
    }
    const market = new Map(prices.filter((p) => p.marketPrice > 0).map((p) => [p.productId, p.marketPrice]));

    // Cardmarket-Gegenstücke: nur Namen, die auf beiden Seiten genau einmal vorkommen
    const exp = expansions.get(s.id)?.exp;
    const cmProducts = exp ? guide.sealedByExpansion?.get(exp) ?? [] : [];
    const strict = (n) => nameKey(n);
    const loose = (n) => nameKey(n, true);
    const [cmStrict, cmLoose] = [uniqueBy(cmProducts, strict), uniqueBy(cmProducts, loose)];
    const [tcgStrict, tcgLoose] = [uniqueBy(products, strict), uniqueBy(products, loose)];
    const counterpart = (p) =>
      (tcgStrict.get(strict(p.name)) && cmStrict.get(strict(p.name))) ||
      (tcgLoose.get(loose(p.name)) && cmLoose.get(loose(p.name))) ||
      null;

    db.transaction(() => {
      for (const p of products) {
        const cm = counterpart(p);
        const cmCents = cm ? cents(robustPrice(guide.prices.get(cm.id) ?? {})) : null;
        const tcgCents = market.get(p.productId) ? cents(market.get(p.productId) * rate) : null;
        const price = blend(cmCents, tcgCents);
        upsertStmt.run({
          set_id: s.id,
          tcg_product_id: p.productId,
          name: p.name,
          image: p.imageUrl ? p.imageUrl.replace("_200w", "_400w") : null,
          cm_product_id: cm?.id ?? null,
          cm_name: cm?.name ?? null,
          cm_cents: cmCents,
          tcg_cents: tcgCents,
          price_cents: price,
          updated_at: now,
        });
        stats.produkte++;
        if (cm) stats.mitCardmarket++;
        if (price) stats.mitPreis++;
      }
    })();
    stats.sets++;
  }
  console.log(
    `[sealed-katalog] ${stats.produkte} Produkte in ${stats.sets} Sets (${stats.mitCardmarket} mit Cardmarket-Gegenstück, ${stats.mitPreis} mit Wert).`
  );
  return stats;
}

const catalogStmt = db.prepare(`
  SELECT id, name, image, price_cents, cm_name, updated_at FROM sealed_catalog
  WHERE set_id = ? ORDER BY price_cents IS NULL, price_cents DESC, name
`);
export function catalogForSet(setId) {
  return catalogStmt.all(setId).map((c) => ({
    id: c.id,
    name: c.name,
    image: c.image,
    priceCents: c.price_cents,
    updated: c.updated_at,
    link: searchLink(c.cm_name ?? c.name),
  }));
}

// Einmal nach dem Deploy (Marker), damit die Auswahl nicht erst nach dem nächsten Nachtlauf da ist
export function catchUpSealedCatalog() {
  if (db.prepare(`SELECT value FROM app_meta WHERE key = 'sealed_catalog_v1'`).get()) return;
  setTimeout(async () => {
    try {
      await refreshSealedCatalog();
      db.prepare(`INSERT OR REPLACE INTO app_meta (key, value) VALUES ('sealed_catalog_v1', '1')`).run();
    } catch (e) {
      console.error("[sealed-katalog] Nachholen fehlgeschlagen (wird nachts erneut versucht):", e.message);
    }
  }, 150_000);
}
