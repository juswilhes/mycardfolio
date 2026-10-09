import cron from "node-cron";
import { recordPrices } from "./cardService.js";
import { getCardmarketPrices } from "./priceProvider.js";
import { recordAllPortfolioSnapshots } from "./portfolioService.js";
import { backfillAllMissingPrices } from "./setPriceBackfill.js";
import { syncNewCards } from "./newCardsSync.js";
import { repairImages } from "./imageRepair.js";
import { rebuildAnalysisCache } from "./analysisCache.js";
import { recordSetValueSnapshots } from "./setValueSnapshots.js";
import { rebuildSitemap } from "./seo.js";
import { refreshVariantFlags } from "./variantFlags.js";
import { refreshPricesFromGuide } from "./guidePrices.js";
import db from "../db/index.js";

// ALLE Preise werden nur noch hier geholt: einmal täglich um 1 Uhr nachts
// (deutsche Zeit). Früher gab es zusätzlich einen 4-Stunden-Job, einen
// Abruf beim Öffnen jeder Karten-/Set-Seite und einen Sweep beim Serverstart -
// das hat bei inzwischen 20.000+ Karten die Seiten stark verlangsamt.

// Jede Karte, die schon einmal einen Preis-Snapshot hatte (Sammlung ODER
// einfach nur auf der Datenbank-Seite angesehen), bekommt weiter täglich
// einen neuen Snapshot - sonst bliebe der Graph für angesehene, aber nicht
// besessene Karten für immer bei "ein einzelner Punkt" stehen.
// Karten, die heute schon über die Cardmarket-Preisliste bepreist wurden
// (guidePrices.js), brauchen keinen Einzelabruf mehr - übrig bleiben nur die, die sich
// dort nicht eindeutig zuordnen ließen.
const trackedCards = db.prepare(`
  SELECT DISTINCT c.id, c.external_id
  FROM cards c
  JOIN price_snapshots ps ON ps.card_id = c.id
  WHERE NOT EXISTS (
    SELECT 1 FROM price_snapshots t
    WHERE t.card_id = c.id AND t.source = 'cardmarket' AND t.price_type = 'trend'
      AND t.variant = 'normal' AND substr(t.fetched_at, 1, 10) = date('now')
  )
`);

const CONCURRENCY = 5;
const PAUSE_MS = 100; // TCGdex schonen

let running = false;

// Zieht für jede bereits einmal bepreiste Karte den aktuellen Cardmarket-
// Preis (EUR) nach und legt einen Snapshot an. Das ist der Baustein, der
// die Preishistorie ohne manuelles Zutun wachsen lässt.
async function refreshAllPrices() {
  const cards = trackedCards.all();
  console.log(`[priceFetcher] Aktualisiere ${cards.length} Karten ...`);

  let i = 0;
  let ok = 0;
  async function worker() {
    while (i < cards.length) {
      const card = cards[i++];
      try {
        // force: true - der Job soll wirklich frisch bei TCGdex nachfragen,
        // nicht den 6h-Zwischenspeicher treffen.
        const { prices, meta } = await getCardmarketPrices(card.external_id, { force: true });
        if (prices.length) {
          recordPrices(card.id, prices, meta);
          ok++;
        }
      } catch (err) {
        console.error(`[priceFetcher] Fehler bei ${card.external_id}:`, err.message);
      }
      await new Promise((r) => setTimeout(r, PAUSE_MS));
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  console.log(`[priceFetcher] Fertig - ${ok}/${cards.length} mit Preis.`);
}

// Der komplette Nachtlauf um 1 Uhr:
//  1. neue Sets/Karten bei TCGdex suchen und importieren (damit sie gleich
//     mit Preisen und Bildern versorgt werden)
//  2. welche Ausführungen (normal/Reverse Holo/Holo) jede Karte hat (variantFlags.js),
//     dann die Preise: zuerst alle Karten in einem Rutsch aus Cardmarkets Preisliste
//     (guidePrices.js), danach per Einzelabruf nur noch die übrigen
//  3. Karten ohne jeden Preis nachholen
//  4. alle Auswertungen der Analyse mit den neuen Preisen neu rechnen
//     (analysisCache.js), am Monatsersten den Monatsstand speichern und die
//     Sitemap (alle Sets/Karten für Google) neu bauen
//  5. fehlende/kaputte Kartenbilder reparieren (sonntags alle Karten)
//  6. Tagespunkt je Nutzer für den Portfolio-Graphen
// Jeder Schritt einzeln abgesichert - ein Fehler (z.B. TCGdex kurz down)
// soll die übrigen nicht verhindern.
export async function runDailyPriceJob() {
  if (running) {
    console.log("[priceFetcher] Läuft schon - übersprungen.");
    return;
  }
  running = true;
  try {
    const steps = [
      ["Neu-Check", syncNewCards],
      ["Ausführungen", refreshVariantFlags],
      ["Preisliste", refreshPricesFromGuide],
      ["Preise", refreshAllPrices],
      ["Preise nachholen", backfillAllMissingPrices],
      ["Analysen", async () => rebuildAnalysisCache()],
      ["Monatsstand", async () => recordSetValueSnapshots({ onlyMissing: true })],
      ["Sitemap", async () => rebuildSitemap()],
      // sonntags alle Karten prüfen (~3 Min.), sonst nur die üblichen Verdächtigen
      ["Bilder", () => repairImages({ full: new Date().getDay() === 0 })],
      ["Portfolio", async () => recordAllPortfolioSnapshots()],
    ];
    for (const [name, fn] of steps) {
      try {
        await fn();
      } catch (e) {
        console.error(`[nachtlauf] Schritt "${name}" fehlgeschlagen:`, e);
      }
    }
  } finally {
    running = false;
  }
}

export function schedulePriceFetching() {
  cron.schedule(
    "0 1 * * *",
    () => {
      runDailyPriceJob().catch((e) => console.error("[priceFetcher] Job fehlgeschlagen:", e));
    },
    { timezone: "Europe/Berlin" }
  );
  console.log("[priceFetcher] Täglicher Preis-Job um 1:00 Uhr (Europe/Berlin) eingeplant.");
}
