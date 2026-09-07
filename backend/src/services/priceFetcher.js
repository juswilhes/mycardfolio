import cron from "node-cron";
import { getCardById } from "./pokemonTcgApi.js";
import { saveCardWithPrices, allCardsForGame } from "./cardService.js";

// Zieht für jede in der DB bekannte Karte den aktuellen Preis nach und
// legt einen neuen price_snapshot an. Das ist der Baustein, der die
// Preishistorie ohne manuelles Zutun wachsen lässt.
export async function refreshAllPrices() {
  const cards = allCardsForGame.all();
  console.log(`[priceFetcher] Aktualisiere ${cards.length} Karten ...`);

  for (const card of cards) {
    try {
      if (card.game_slug === "pokemon") {
        const fresh = await getCardById(card.external_id);
        saveCardWithPrices("pokemon", fresh);
      }
      // Weitere Spiele (z.B. "mtg") würden hier als eigener Branch ergänzt.
    } catch (err) {
      console.error(`[priceFetcher] Fehler bei Karte ${card.external_id}:`, err.message);
    }
    // kleine Pause, um das Rate-Limit der kostenlosen API zu schonen
    await new Promise((r) => setTimeout(r, 300));
  }
  console.log("[priceFetcher] Fertig.");
}

// Läuft täglich um 06:00 Uhr. Cron-Ausdruck bei Bedarf anpassen.
export function schedulePriceFetching() {
  cron.schedule("0 6 * * *", () => {
    refreshAllPrices().catch((e) => console.error("[priceFetcher] Job fehlgeschlagen:", e));
  });
  console.log("[priceFetcher] Täglicher Job um 06:00 Uhr eingeplant.");
}
