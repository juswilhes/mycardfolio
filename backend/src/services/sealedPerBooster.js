import db from "../db/index.js";
import { slugOfSet } from "./setSlugs.js";
import { sealedForSet } from "./sealedPrices.js";

// Analyse "Preis pro Booster" (Justus 13.11.2026): je Set alle Sealed-Produkte mit bekannter Booster-Anzahl,
// umgerechnet auf den Preis je Booster - welches Produkt ist der günstigste Weg an Booster dieses Sets?
// Dazu je Set Einzelbooster- und Displaypreis (dieselben Werte wie oben auf der Set-Seite).
// Booster-Anzahl und Promo-Wert stehen im Katalog (sealedContents.js, Nachtlauf-Schritt "Sealed-Katalog").
// - Promo-Karten: ihr (vorsichtig gerechneter) Wert wird abgezogen, aber nur, wenn er unter 80 % des Produktpreises
//   liegt - sonst stimmt vermutlich die Zuordnung der Karte nicht und es wird nichts abgezogen.
// - Plausibilität: liegt der Preis je Booster unter dem 0,45-Fachen oder über dem 6-Fachen des Einzelboosters, ist
//   fast sicher die Booster-Anzahl falsch gelesen - das Produkt fehlt dann, statt eine falsche Zahl zu zeigen.
const MIN_FACTOR = 0.45;
const MAX_FACTOR = 6;
const MAX_PROMO_SHARE = 0.8;

const productsStmt = db.prepare(`
  SELECT c.id, c.set_id, c.name, c.image, c.price_cents, c.booster_count, c.promo_value_cents,
         EXISTS (SELECT 1 FROM sealed_catalog_sets x WHERE x.catalog_id = c.id) AS mixed
  FROM sealed_catalog c
  WHERE c.set_id != '' AND c.booster_count > 0 AND c.price_cents > 0 AND c.updated_at >= date('now', '-3 day')
`);
const setsStmt = db.prepare(`SELECT id, name, series, release_date FROM card_sets`);

export function buildPricePerBooster() {
  const bySet = new Map();
  for (const p of productsStmt.all()) {
    if (!bySet.has(p.set_id)) bySet.set(p.set_id, []);
    bySet.get(p.set_id).push(p);
  }
  const out = [];
  for (const s of setsStmt.all()) {
    const list = bySet.get(s.id);
    if (!list) continue;
    const sealed = sealedForSet(s.id);
    // Einzelbooster: der Preis der Set-Seite, sonst das günstigste Ein-Booster-Produkt mit "Booster Pack" im Namen
    const singles = list.filter((p) => p.booster_count === 1 && /booster pack/i.test(p.name) && !/sleeved/i.test(p.name));
    const boosterCents = sealed?.booster?.priceCents ?? (singles.length ? Math.min(...singles.map((p) => p.price_cents)) : null);

    const products = list
      .map((p) => {
        const promo = p.promo_value_cents && p.promo_value_cents < p.price_cents * MAX_PROMO_SHARE ? p.promo_value_cents : 0;
        return {
          id: p.id,
          name: p.name,
          image: p.image,
          priceCents: p.price_cents,
          boosters: p.booster_count,
          perBoosterCents: Math.round(p.price_cents / p.booster_count),
          promoCents: promo || null,
          // maßgeblich für die Reihenfolge: Preis je Booster nach Abzug der Promo-Karten
          netPerBoosterCents: Math.round((p.price_cents - promo) / p.booster_count),
          mixed: !!p.mixed, // Booster aus mehreren Sets
        };
      })
      .filter((p) => !boosterCents || (p.perBoosterCents >= boosterCents * MIN_FACTOR && p.perBoosterCents <= boosterCents * MAX_FACTOR))
      .sort((a, b) => a.netPerBoosterCents - b.netPerBoosterCents || a.name.localeCompare(b.name));
    if (products.length < 2) continue;

    // Display: das Produkt aus der Liste (gleiche Zahl wie in der Aufklapp-Tabelle), sonst der Preis der Set-Seite
    const display = sealed?.display ?? null;
    const displayRow = display?.catalogId ? products.find((p) => p.id === display.catalogId) : null;
    const displayCents = displayRow?.priceCents ?? display?.priceCents ?? null;
    const displayBoosters = displayRow?.boosters ?? 36;
    out.push({
      id: s.id,
      slug: slugOfSet(s.id),
      name: s.name,
      series: s.series,
      release_date: s.release_date,
      boosterCents,
      displayCents,
      displayBoosters: displayCents ? displayBoosters : null,
      displayPerBoosterCents: displayCents ? Math.round(displayCents / displayBoosters) : null,
      displayCatalogId: display?.catalogId ?? null,
      products,
    });
  }
  return out.sort((a, b) => (b.release_date || "").localeCompare(a.release_date || ""));
}
