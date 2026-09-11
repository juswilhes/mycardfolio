// Befüllt gezielt Preis-Snapshots für die "Chase"-Karten jedes Sets (jenseits
// von Common/Uncommon/Rare/Rare Holo/Promo), damit die Set-Übersicht unter
// "Markt" echte Daten für ALLE Sets zeigt statt nur für zufällig von
// Nutzern angesehene Karten. Einmalig laufen lassen (npm run seed-set-prices);
// der tägliche Preis-Job (priceFetcher.js) hält diese Karten danach von
// selbst aktuell, weil er jede Karte mit mindestens einem Snapshot pflegt.
import db from "../db/index.js";
import { upsertCardRow, recordPrices } from "../services/cardService.js";
import { getCardmarketPrices } from "../services/priceProvider.js";

const BASE_RARITIES = new Set(["Common", "Uncommon", "Rare", "Rare Holo", "Promo"]);
const MAX_PER_SET = 6;

const setsStmt = db.prepare(`SELECT id, name FROM card_sets ORDER BY release_date DESC`);
const cardsForSetStmt = db.prepare(`SELECT id, external_id, rarity, number FROM cards WHERE set_id = ?`);

async function main() {
  const sets = setsStmt.all();
  let tried = 0;
  let ok = 0;

  for (const set of sets) {
    const candidates = cardsForSetStmt
      .all(set.id)
      .filter((c) => !BASE_RARITIES.has(c.rarity ?? "Common"))
      .sort((a, b) => (parseInt(b.number, 10) || 0) - (parseInt(a.number, 10) || 0))
      .slice(0, MAX_PER_SET);

    for (const c of candidates) {
      tried++;
      try {
        const { prices, meta } = await getCardmarketPrices(c.external_id);
        if (prices.length) {
          recordPrices(c.id, prices, meta);
          ok++;
        }
      } catch {
        /* Karte überspringen, weiter mit der nächsten */
      }
      await new Promise((r) => setTimeout(r, 200));
    }
    console.log(`[seed-set-prices] ${set.name}: ${candidates.length} Kandidaten`);
  }

  console.log(`[seed-set-prices] fertig - ${ok}/${tried} Karten mit Preis, ${sets.length} Sets geprüft`);
  db.close();
}

main().catch((err) => {
  console.error("[seed-set-prices] Fehler:", err);
  process.exit(1);
});
