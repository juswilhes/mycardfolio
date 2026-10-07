import cron from "node-cron";
import { recordPrices } from "./cardService.js";
import { getCardmarketPrices } from "./priceProvider.js";
import { recordAllPortfolioSnapshots } from "./portfolioService.js";
import { backfillAllMissingPrices } from "./setPriceBackfill.js";
import db from "../db/index.js";

// ALLE Preise werden nur noch hier geholt: einmal täglich um 1 Uhr nachts
// (deutsche Zeit). Früher gab es zusätzlich einen 4-Stunden-Job, einen
// Abruf beim Öffnen jeder Karten-/Set-Seite und einen Sweep beim Serverstart -
// das hat bei inzwischen 20.000+ Karten die Seiten stark verlangsamt.

// Jede Karte, die schon einmal einen Preis-Snapshot hatte (Sammlung ODER
// einfach nur auf der Datenbank-Seite angesehen), bekommt weiter täglich
// einen neuen Snapshot - sonst bliebe der Graph für angesehene, aber nicht
// besessene Karten für immer bei "ein einzelner Punkt" stehen.
const trackedCards = db.prepare(`
  SELECT DISTINCT c.id, c.external_id
  FROM cards c
  JOIN price_snapshots ps ON ps.card_id = c.id
`);

const CONCURRENCY = 5;
const PAUSE_MS = 100; // TCGdex schonen

let running = false;

// Zieht für jede bereits einmal bepreiste Karte den aktuellen Cardmarket-
// Preis (EUR) nach und legt einen Snapshot an. Das ist der Baustein, der
// die Preishistorie ohne manuelles Zutun wachsen lässt.
export async function refreshAllPrices() {
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

// Der komplette Tageslauf: alle Preise aktualisieren, danach Karten ohne
// jeden Preis nachholen (z.B. frisch importierte Sets), danach den
// Tagespunkt je Nutzer für den Portfolio-Graphen.
export async function runDailyPriceJob() {
  if (running) {
    console.log("[priceFetcher] Läuft schon - übersprungen.");
    return;
  }
  running = true;
  try {
    await refreshAllPrices();
    await backfillAllMissingPrices();
    recordAllPortfolioSnapshots();
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
