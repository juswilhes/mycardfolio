// Importiert einzelne Sets aus der TCGdex-API, die im pokemon-tcg-data-
// Datensatz (noch) fehlen - z.B. die Mega-Evolution-Promos.
//
//   npm run import-tcgdex                 -> Standard: mep, mee
//   npm run import-tcgdex -- mep mee sv10 -> beliebige TCGdex-Set-IDs
//
// Danach ganz normal in Suche und "Alle Karten" verfügbar. (Neue Sets und
// Karten holt außerdem jede Nacht um 1 Uhr services/newCardsSync.js.)

import { importTcgdexSet } from "../services/tcgdexImport.js";

const setIds = process.argv.slice(2).length ? process.argv.slice(2) : ["mep", "mee"];
for (const sid of setIds) await importTcgdexSet(sid);
console.log("Fertig.");
