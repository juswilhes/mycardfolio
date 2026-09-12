// Deutsche Kartennamen von TCGdex nachladen - nicht nur für Pokémon (das
// deckt schon pokemon-de-en.json ab), sondern für ALLE Karten inkl.
// Trainer-/Item-/Supporter-Karten ("Seltene Süßigkeit", "Schmetterhammer",
// ...), die mit der reinen Pokémon-Namensliste nie gefunden wurden.
//
// Läuft pro SET (ein TCGdex-Bulk-Aufruf je Set, nicht pro Karte), matcht
// Karten über die normalisierte Kartennummer und schreibt das Ergebnis in
// cards.name_de. Wiederholt ausführbar (überschreibt vorhandene Werte).
//
//   npm run build-german-card-names

import db from "../db/index.js";
import { tcgdexSetId } from "../services/priceProvider.js";

const API = "https://api.tcgdex.net/v2/de";
const normNum = (n) => {
  const s = String(n ?? "").trim();
  return /^\d+$/.test(s) ? String(parseInt(s, 10)) : s.toUpperCase().replace(/^0+/, "");
};

async function fetchJson(url, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": "MyCardfolio/1.0" } });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      if (i === tries - 1) throw err;
      await new Promise((r) => setTimeout(r, 400 * (i + 1)));
    }
  }
}

const setsStmt = db.prepare(`
  SELECT id, name FROM card_sets
  WHERE game_id = (SELECT id FROM games WHERE slug = 'pokemon')
  ORDER BY release_date DESC
`);
const cardsInSetStmt = db.prepare(`SELECT external_id, number FROM cards WHERE set_id = ?`);
const updateNameDe = db.prepare(`UPDATE cards SET name_de = ? WHERE external_id = ?`);

const sets = setsStmt.all();
console.log(`${sets.length} Sets - löse TCGdex-IDs auf und hole deutsche Namen ...`);

let updated = 0;
let unresolved = [];

for (const set of sets) {
  let tid;
  try {
    tid = await tcgdexSetId(set.name, set.id);
  } catch (err) {
    console.error(`  ${set.id}: Fehler beim Auflösen (${err.message})`);
    continue;
  }
  if (!tid) {
    unresolved.push(set.id);
    continue;
  }

  const deSet = await fetchJson(`${API}/sets/${tid}`);
  if (!deSet?.cards?.length) {
    unresolved.push(`${set.id} (${tid})`);
    continue;
  }

  const byNum = new Map();
  for (const c of deSet.cards) {
    const key = normNum(c.localId);
    if (!byNum.has(key)) byNum.set(key, c.name); // erste Karte je Nummer gewinnt (Doppel selten)
  }

  const ourCards = cardsInSetStmt.all(set.id);
  let setUpdated = 0;
  for (const card of ourCards) {
    const name = byNum.get(normNum(card.number));
    if (name) {
      updateNameDe.run(name, card.external_id);
      setUpdated++;
    }
  }
  updated += setUpdated;
  console.log(`  ${set.id} -> ${tid}: ${setUpdated}/${ourCards.length} Karten`);
}

console.log(`\nFertig: ${updated} Karten mit deutschem Namen versehen.`);
if (unresolved.length) {
  console.log(`${unresolved.length} Sets nicht bei TCGdex gefunden:`, unresolved.join(", "));
}
