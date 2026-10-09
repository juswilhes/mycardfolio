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

// Einmalig nach einem Deploy im Hintergrund (jeweils mit Marker, erst nach Abschluss gesetzt):
//  1. Karten, die bisher gar keinen Preis hatten, über die Rückfallquelle bepreisen
//  2. Karten, die sich ein Cardmarket-Produkt mit einer Karte desselben Sets teilen, neu
//     abfragen - dabei greift die Gegenprüfung auf falsche Zuordnungen (priceProvider.js)
// Danach hält der Nachtlauf um 1 Uhr alles aktuell; so muss niemand bis zum nächsten
// Nachtlauf auf die Korrektur warten.
const sharedProductCardsStmt = db.prepare(`
  SELECT c.id, c.external_id FROM cards c
  WHERE c.cardmarket_product_id IS NOT NULL
    AND EXISTS (SELECT 1 FROM cards o WHERE o.cardmarket_product_id = c.cardmarket_product_id AND o.set_id = c.set_id AND o.id != c.id)
`);

async function recheckSharedProductCards() {
  const cards = sharedProductCardsStmt.all();
  console.log(`[priceBackfill] Gegenprüfung: ${cards.length} Karten mit geteiltem Cardmarket-Produkt ...`);
  let i = 0;
  async function worker() {
    while (i < cards.length) {
      const card = cards[i++];
      try {
        const { prices, meta } = await getCardmarketPrices(card.external_id, { force: true });
        if (prices.length) recordPrices(card.id, prices, meta);
      } catch {
        /* eine fehlgeschlagene Karte darf den Durchlauf nicht stoppen */
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  console.log("[priceBackfill] Gegenprüfung fertig.");
}

export function catchUpMissingPrices() {
  const marker = (key) => db.prepare(`SELECT value FROM app_meta WHERE key = ?`).get(key);
  const setMarker = (key) => db.prepare(`INSERT OR REPLACE INTO app_meta (key, value) VALUES (?, '1')`).run(key);
  // beide gleichzeitig: die Abrufe bei pokemontcg.io teilen sich ohnehin die Pause zwischen den Starts
  setTimeout(() => {
    if (!marker("missing_prices_fallback_v1")) backfillAllMissingPrices().then(() => setMarker("missing_prices_fallback_v1"));
    if (!marker("shared_product_check_v1")) recheckSharedProductCards().then(() => setMarker("shared_product_check_v1"));
  }, 60_000);
}

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
