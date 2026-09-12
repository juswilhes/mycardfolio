// Füllt fehlende Preise für ein ganzes Set im Hintergrund nach. Preise
// entstehen bisher nur, wenn jemand eine einzelne Karte ansieht ("Preis bei
// Bedarf") - in der Set-Übersicht fehlten dadurch die meisten. Sobald eine
// Karte hier einen Preis bekommt, übernimmt der normale 4h-Cron
// (priceFetcher.js) sie automatisch dauerhaft, weil sie dann einen
// price_snapshot hat ("getrackt" ist).
//
// Läuft bewusst NICHT synchron zur Anfrage (Sets haben oft 150-300 Karten,
// das würde die Seite ewig blockieren), sondern im Hintergrund mit wenig
// Parallelität, um TCGdex nicht zu überlasten.

import { getCardsBySetLocal } from "./cardRepository.js";
import { getCardmarketPrices } from "./priceProvider.js";
import { recordPrices, cardIdByExternalId, pricesForSet } from "./cardService.js";

const CONCURRENCY = 6;
const COOLDOWN_MS = 30 * 60 * 1000; // pro Set nicht öfter als alle 30 Min. neu versuchen

const inProgress = new Set();
const lastAttempt = new Map();

export function backfillSetPrices(setId) {
  if (inProgress.has(setId)) return;
  const last = lastAttempt.get(setId);
  if (last && Date.now() - last < COOLDOWN_MS) return;

  inProgress.add(setId);
  lastAttempt.set(setId, Date.now());

  run(setId).finally(() => inProgress.delete(setId));
}

async function run(setId) {
  const cards = getCardsBySetLocal(setId);
  const existing = pricesForSet(setId);
  const missing = cards.filter((c) => existing.get(c.external_id) == null);
  if (!missing.length) return;

  let i = 0;
  async function worker() {
    while (i < missing.length) {
      const card = missing[i++];
      try {
        const { prices, meta } = await getCardmarketPrices(card.external_id);
        if (prices.length) {
          const row = cardIdByExternalId.get(card.external_id);
          if (row) recordPrices(row.id, prices, meta);
        }
      } catch {
        /* eine fehlgeschlagene Karte darf den Rest nicht stoppen */
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
}
