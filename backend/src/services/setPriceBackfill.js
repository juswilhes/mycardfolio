// Holt Preise für Karten, die noch nie einen Preis-Snapshot hatten (z.B.
// frisch importierte Sets). Läuft als Teil des täglichen Preis-Jobs um 1 Uhr
// (priceFetcher.js) - nicht mehr beim Öffnen einer Set-Seite und nicht mehr
// beim Serverstart.

import db from "../db/index.js";
import { getCardmarketPrices } from "./priceProvider.js";
import { recordPrices } from "./cardService.js";

const CONCURRENCY = 6;

// Sucht ALLE Karten aus ALLEN Sets ohne jeden Preis-Snapshot - garantiert,
// dass irgendwann wirklich jede Karte erfasst wird, unabhängig vom
// Besucherverkehr.
const missingPriceCardsStmt = db.prepare(`
  SELECT c.id, c.external_id
  FROM cards c
  LEFT JOIN price_snapshots ps ON ps.card_id = c.id
  WHERE ps.id IS NULL
`);

let sweepRunning = false;

export async function backfillAllMissingPrices() {
  if (sweepRunning) return;
  sweepRunning = true;
  try {
    const missing = missingPriceCardsStmt.all();
    if (!missing.length) return;
    console.log(`[priceBackfill] Sweep: ${missing.length} Karten ohne Preis-Snapshot ...`);

    let i = 0;
    let ok = 0;
    async function worker() {
      while (i < missing.length) {
        const card = missing[i++];
        try {
          const { prices, meta } = await getCardmarketPrices(card.external_id);
          if (prices.length) {
            recordPrices(card.id, prices, meta);
            ok++;
          }
        } catch {
          /* eine fehlgeschlagene Karte darf den Sweep nicht stoppen */
        }
      }
    }
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
    console.log(`[priceBackfill] Sweep fertig - ${ok}/${missing.length} neu bepreist.`);
  } finally {
    sweepRunning = false;
  }
}
