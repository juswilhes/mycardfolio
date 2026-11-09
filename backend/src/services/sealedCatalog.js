import db from "../db/index.js";
import { loadGuide } from "./cardmarketGuide.js";
import { robustPrice, usdToEur } from "./priceProvider.js";
import { sealedExpansions, groupKey, tcgJson, TCG_GROUP_ALIAS, searchLink } from "./sealedPrices.js";
import { setsFor, promosFor, seriesOfSet, resetContentsContext } from "./sealedContents.js";
import { slugOfSet } from "./setSlugs.js";
import { slugOfCard } from "./cardSlugs.js";

// Katalog der versiegelten Produkte je Set (Justus 08.11.2026: "Sealed-Produkte über die Cardmarket- und
// TCGplayer-Infos hinzufügen"): Auswahl mit Bild beim Hinzufügen statt Handeingabe, Wert automatisch jede Nacht.
// Produktliste und Bilder von TCGplayer (tcgcsv.com, alles außer Einzelkarten, Cases und Code Cards), Cardmarket-
// Gegenstück über den gleichen Namen in der Erweiterung des Sets (nur eindeutig). Wert wie bei Booster/Display
// (sealedPrices.js): Mittelwert aus Cardmarket und TCGplayer, wenn beide da sind und höchstens 2,5x auseinander;
// sonst Cardmarket, ohne Cardmarket-Gegenstück TCGplayer allein.
const MAX_FACTOR = 2.5;
const EXCLUDE = /\bcase\b|code card/i;
// TCGplayer-Gruppen ohne eigenes Set, in denen trotzdem versiegelte Produkte liegen (Kollektionen, Tins, Händler-
// Bundles ...; Justus 09.11.2026). Bewusst eine Positivliste: andere Gruppen (World-Championship-Decks, Promo-/
// Einzelkarten-Gruppen) sind keine Sealed-Produkte im Sinn der Sammlung.
const EXTRA_GROUPS = /miscellaneous|battle academy|my first battle|first partner|trick or trade|deck exclusives|trainer kit|battle stadium/i;
const descOf = (p) => (p.extendedData ?? []).find((e) => e.name === "CardText")?.value ?? "";

const delSetsStmt = db.prepare(`DELETE FROM sealed_catalog_sets WHERE catalog_id = ?`);
const insSetStmt = db.prepare(`INSERT OR IGNORE INTO sealed_catalog_sets (catalog_id, set_id) VALUES (?, ?)`);
const delPromosStmt = db.prepare(`DELETE FROM sealed_catalog_promos WHERE catalog_id = ?`);
const insPromoStmt = db.prepare(`INSERT OR IGNORE INTO sealed_catalog_promos (catalog_id, card_external_id) VALUES (?, ?)`);
// Weitere Sets und Promo-Karten eines Produkts neu schreiben (jede Nacht, die Beschreibung kann sich ändern)
function saveLinks(catalogId, extraSets, promoIds) {
  delSetsStmt.run(catalogId);
  for (const id of extraSets) insSetStmt.run(catalogId, id);
  delPromosStmt.run(catalogId);
  for (const id of promoIds) insPromoStmt.run(catalogId, id);
}

const setsStmt = db.prepare(`SELECT id, name FROM card_sets`);
const idByTcgStmt = db.prepare(`SELECT id FROM sealed_catalog WHERE tcg_product_id = ?`);
const upsertPriceStmt = db.prepare(`
  INSERT OR REPLACE INTO sealed_catalog_prices (catalog_id, day, price_cents, cm_cents, tcg_cents) VALUES (?, ?, ?, ?, ?)
`);
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
  const stats = { sets: 0, produkte: 0, mitCardmarket: 0, mitPreis: 0, sammelgruppen: 0, mehrereSets: 0, mitPromos: 0 };
  resetContentsContext(); // neue Sets/Promo-Karten seit dem letzten Lauf berücksichtigen
  const setGroupIds = new Set();

  for (const s of setsStmt.all()) {
    const alias = TCG_GROUP_ALIAS[s.id];
    const hits = groups.filter((g) => (alias ? g.name === alias : groupKey(g.name) === groupKey(s.name)));
    if (hits.length !== 1) continue;
    setGroupIds.add(hits[0].groupId);
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
        const catalogId = idByTcgStmt.get(p.productId).id;
        if (price) upsertPriceStmt.run(catalogId, now.slice(0, 10), price, cmCents, tcgCents);
        // weitere Sets (Booster aus mehreren Sets) und beiliegende Promo-Karten aus der Beschreibung
        const desc = descOf(p);
        const links = setsFor(p.name, desc, s.id);
        const promos = promosFor(desc, seriesOfSet(s.id));
        saveLinks(catalogId, links.sets, promos);
        stats.produkte++;
        if (links.sets.length) stats.mehrereSets++;
        if (promos.length) stats.mitPromos++;
        if (cm) stats.mitCardmarket++;
        if (price) stats.mitPreis++;
      }
    })();
    stats.sets++;
  }

  // Sammelgruppen ohne eigenes Set: kein Cardmarket-Gegenstück (das hängt an der Set-Erweiterung), Wert nur von
  // TCGplayer. Das Haupt-Set steht im Produktnamen oder in den Booster-Sätzen; sonst bleibt set_id leer
  // (Produkt ist über die Suche und seine eigene Seite erreichbar, steht aber auf keiner Set-Seite).
  for (const g of groups) {
    if (setGroupIds.has(g.groupId) || !EXTRA_GROUPS.test(g.name)) continue;
    try {
      const products = (await tcgJson(`/${g.groupId}/products`)).filter(
        (p) => !(p.extendedData ?? []).some((e) => e.name === "Number") && !EXCLUDE.test(p.name)
      );
      if (!products.length) continue;
      const prices = await tcgJson(`/${g.groupId}/prices`);
      const market = new Map(prices.filter((p) => p.marketPrice > 0).map((p) => [p.productId, p.marketPrice]));
      db.transaction(() => {
        for (const p of products) {
          const desc = descOf(p);
          const links = setsFor(p.name, desc, null);
          const tcgCents = market.get(p.productId) ? cents(market.get(p.productId) * rate) : null;
          upsertStmt.run({
            set_id: links.primary ?? "",
            tcg_product_id: p.productId,
            name: p.name,
            image: p.imageUrl ? p.imageUrl.replace("_200w", "_400w") : null,
            cm_product_id: null,
            cm_name: null,
            cm_cents: null,
            tcg_cents: tcgCents,
            price_cents: tcgCents,
            updated_at: now,
          });
          const catalogId = idByTcgStmt.get(p.productId).id;
          if (tcgCents) upsertPriceStmt.run(catalogId, now.slice(0, 10), tcgCents, null, tcgCents);
          const promos = promosFor(desc, links.primary ? seriesOfSet(links.primary) : null);
          saveLinks(catalogId, links.sets, promos);
          stats.sammelgruppen++;
          if (promos.length) stats.mitPromos++;
          if (tcgCents) stats.mitPreis++;
        }
      })();
    } catch (e) {
      console.warn(`[sealed-katalog] Gruppe ${g.name}: ${e.message}`);
    }
  }
  console.log(
    `[sealed-katalog] ${stats.produkte} Produkte in ${stats.sets} Sets (${stats.mitCardmarket} mit Cardmarket-Gegenstück, ${stats.mitPreis} mit Wert), ` +
      `${stats.sammelgruppen} aus Sammelgruppen, ${stats.mehrereSets} mit Boostern aus mehreren Sets, ${stats.mitPromos} mit Promo-Karten.`
  );
  return stats;
}

// Auf der Seite eines Sets stehen auch Produkte, deren Haupt-Set ein anderes ist, die aber Booster dieses Sets
// enthalten (sealed_catalog_sets); homeSetName sagt dann, wo sie eigentlich hingehören.
const catalogStmt = db.prepare(`
  SELECT c.id, c.name, c.image, c.price_cents, c.cm_name, c.updated_at, c.set_id AS home_id, hs.name AS home_name
  FROM sealed_catalog c LEFT JOIN card_sets hs ON hs.id = c.set_id
  WHERE c.set_id = @setId OR c.id IN (SELECT catalog_id FROM sealed_catalog_sets WHERE set_id = @setId)
  ORDER BY c.price_cents IS NULL, c.price_cents DESC, c.name
`);
const countStmt = db.prepare(`
  SELECT COUNT(*) n FROM sealed_catalog
  WHERE set_id = @setId OR id IN (SELECT catalog_id FROM sealed_catalog_sets WHERE set_id = @setId)
`);
export const catalogCount = (setId) => countStmt.get({ setId }).n;

export function catalogForSet(setId) {
  return catalogStmt.all({ setId }).map((c) => ({
    id: c.id,
    name: c.name,
    image: c.image,
    priceCents: c.price_cents,
    updated: c.updated_at,
    link: searchLink(c.cm_name ?? c.name),
    homeSetName: c.home_id && c.home_id !== setId ? c.home_name : null,
  }));
}

// Alle Sets eines Produkts (Haupt-Set zuerst) und seine Promo-Karten, für die Produktseite
const itemSetsStmt = db.prepare(`
  SELECT s.id, s.name FROM card_sets s
  WHERE s.id = (SELECT set_id FROM sealed_catalog WHERE id = @id) OR s.id IN (SELECT set_id FROM sealed_catalog_sets WHERE catalog_id = @id)
  ORDER BY (s.id = (SELECT set_id FROM sealed_catalog WHERE id = @id)) DESC, s.release_date
`);
const itemPromosStmt = db.prepare(`
  SELECT c.external_id, c.name, c.image_small, c.set_name, c.number
  FROM sealed_catalog_promos p JOIN cards c ON c.external_id = p.card_external_id WHERE p.catalog_id = ? ORDER BY c.name
`);
// Zu einer (Promo-)Karte: die Sealed-Produkte, in denen sie beiliegt
const productsOfCardStmt = db.prepare(`
  SELECT c.id, c.name, c.image FROM sealed_catalog_promos p JOIN sealed_catalog c ON c.id = p.catalog_id
  WHERE p.card_external_id = ? ORDER BY c.price_cents IS NULL, c.price_cents DESC, c.name
`);
export const sealedOfCard = (externalId) => productsOfCardStmt.all(externalId);

// Produktseite (/sealed/:id): Daten + Preisverlauf im Format des Karten-Graphen (fetched_at, price, variant)
const itemStmt = db.prepare(`
  SELECT c.id, c.set_id, c.name, c.image, c.price_cents, c.cm_name, c.updated_at, s.name AS set_name, s.release_date, s.logo
  FROM sealed_catalog c LEFT JOIN card_sets s ON s.id = c.set_id WHERE c.id = ?
`);
const historyStmt = db.prepare(`SELECT day, price_cents FROM sealed_catalog_prices WHERE catalog_id = ? ORDER BY day`);
export function catalogItem(id) {
  const c = itemStmt.get(id);
  if (!c) return null;
  return {
    id: c.id,
    name: c.name,
    image: c.image,
    setId: c.set_id,
    setName: c.set_name,
    setLogo: c.logo,
    releaseDate: c.release_date,
    priceCents: c.price_cents,
    updated: c.updated_at,
    link: searchLink(c.cm_name ?? c.name),
    // alle Sets, aus denen Booster im Produkt stecken (Haupt-Set zuerst) - bei nur einem Set bleibt die Liste leer
    sets: (() => {
      const all = itemSetsStmt.all({ id });
      return all.length > 1 ? all.map((s) => ({ id: s.id, name: s.name, slug: slugOfSet(s.id) })) : [];
    })(),
    promos: itemPromosStmt.all(id).map((p) => ({
      external_id: p.external_id,
      slug: slugOfCard(p.external_id),
      name: p.name,
      image_small: p.image_small,
      set_name: p.set_name,
      number: p.number,
    })),
    history: historyStmt.all(id).map((h) => ({ fetched_at: `${h.day}T00:00:00.000Z`, price: h.price_cents / 100, variant: "normal" })),
  };
}

// Einmal nach dem Deploy (Marker), damit die Auswahl nicht erst nach dem nächsten Nachtlauf da ist
export function catchUpSealedCatalog() {
  // v2 (09.11.2026): Sammelgruppen, weitere Sets und Promo-Karten kamen dazu - einmal sofort nach dem Deploy
  if (db.prepare(`SELECT value FROM app_meta WHERE key = 'sealed_catalog_v2'`).get()) return;
  setTimeout(async () => {
    try {
      await refreshSealedCatalog();
      db.prepare(`INSERT OR REPLACE INTO app_meta (key, value) VALUES ('sealed_catalog_v2', '1')`).run();
    } catch (e) {
      console.error("[sealed-katalog] Nachholen fehlgeschlagen (wird nachts erneut versucht):", e.message);
    }
  }, 150_000);
}
