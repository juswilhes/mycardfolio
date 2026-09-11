import cron from "node-cron";
import { recordPrices } from "./cardService.js";
import { getCardmarketPrices } from "./priceProvider.js";
import { recordAllPortfolioSnapshots } from "./portfolioService.js";
import db from "../db/index.js";

// Jede Karte, die schon einmal einen Preis-Snapshot hatte (Sammlung ODER
// einfach nur auf der Datenbank-Seite angesehen), bekommt weiter täglich
// einen neuen Snapshot - sonst bliebe der Graph für angesehene, aber nicht
// besessene Karten für immer bei "ein einzelner Punkt" stehen.
const trackedCards = db.prepare(`
  SELECT DISTINCT c.id, c.external_id
  FROM cards c
  JOIN price_snapshots ps ON ps.card_id = c.id
`);

// Zieht für jede bereits einmal angesehene Karte den aktuellen Cardmarket-
// Preis (EUR) nach und legt einen Snapshot an. Das ist der Baustein, der
// die Preishistorie ohne manuelles Zutun wachsen lässt.
export async function refreshAllPrices() {
  const cards = trackedCards.all();
  console.log(`[priceFetcher] Aktualisiere ${cards.length} Karten ...`);

  let ok = 0;
  for (const card of cards) {
    try {
      const { prices, meta } = await getCardmarketPrices(card.external_id);
      if (prices.length) {
        recordPrices(card.id, prices, meta);
        ok++;
      }
    } catch (err) {
      console.error(`[priceFetcher] Fehler bei ${card.external_id}:`, err.message);
    }
    await new Promise((r) => setTimeout(r, 250)); // TCGdex schonen
  }
  recordAllPortfolioSnapshots(); // Tagespunkt je Nutzer für den Portfolio-Graphen
  console.log(`[priceFetcher] Fertig - ${ok}/${cards.length} mit Preis.`);
}

// Läuft täglich um 06:00 Uhr.
export function schedulePriceFetching() {
  cron.schedule("0 6 * * *", () => {
    refreshAllPrices().catch((e) => console.error("[priceFetcher] Job fehlgeschlagen:", e));
  });
  console.log("[priceFetcher] Täglicher Job um 06:00 Uhr eingeplant.");
}
