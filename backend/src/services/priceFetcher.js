import cron from "node-cron";
import { allCardsForGame, recordPrices } from "./cardService.js";
import { getCardmarketPrices } from "./priceProvider.js";
import db from "../db/index.js";

// Nur Karten, die tatsächlich in der Sammlung liegen, brauchen eine
// wachsende Preishistorie - nicht alle 20.000 Karten des Datensatzes.
const collectionCards = db.prepare(`
  SELECT DISTINCT c.id, c.external_id
  FROM collection_items ci
  JOIN cards c ON c.id = ci.card_id
`);

// Zieht für jede Sammlungskarte den aktuellen Cardmarket-Preis (EUR) nach
// und legt einen Snapshot an. Das ist der Baustein, der die Preishistorie
// ohne manuelles Zutun wachsen lässt.
export async function refreshAllPrices() {
  const cards = collectionCards.all();
  console.log(`[priceFetcher] Aktualisiere ${cards.length} Sammlungskarten ...`);

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
  console.log(`[priceFetcher] Fertig - ${ok}/${cards.length} mit Preis.`);
}

// Läuft täglich um 06:00 Uhr.
export function schedulePriceFetching() {
  cron.schedule("0 6 * * *", () => {
    refreshAllPrices().catch((e) => console.error("[priceFetcher] Job fehlgeschlagen:", e));
  });
  console.log("[priceFetcher] Täglicher Job um 06:00 Uhr eingeplant.");
}
