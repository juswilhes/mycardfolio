import db from "../db/index.js";
import { fetchJson, tcgdexCardId } from "./priceProvider.js";

// Welche Ausführungen gibt es von einer Karte? TCGdex kennt je Karte die
// Angaben normal / reverse (Reverse Holo) / holo. Davon hängt ab, ob wir im
// Graphen eine oder zwei Preisreihen zeigen: Cardmarket liefert für jede
// Karte zwei Preisspalten, aber viele Karten (Illustration Rare, Rare Holo ...)
// gibt es nur in EINER Ausführung - die zweite Spalte wäre dort irreführend.
// Gespeichert als JSON in cards.variant_flags, gelesen in cardService.js.
//
// Statt 20.000 Einzelabfragen reichen wenige Listenabfragen mit Filter
// (z. B. alle Karten mit variants.holo=true) plus die Set-Listen, die der
// Preisabruf ohnehin zwischenspeichert.
const API = "https://api.tcgdex.net/v2/en";
const PAGE = 5000;

async function idsWith(flag) {
  const ids = new Set();
  for (let page = 1; ; page++) {
    const list = await fetchJson(`${API}/cards?variants.${flag}=true&pagination:page=${page}&pagination:itemsPerPage=${PAGE}`);
    if (!list?.length) break;
    for (const c of list) ids.add(c.id);
    if (list.length < PAGE) break;
  }
  return ids;
}

const cardsStmt = db.prepare(`
  SELECT c.id, c.number, c.name, c.set_id, s.name AS set_name
  FROM cards c LEFT JOIN card_sets s ON s.id = c.set_id
  WHERE c.game_id = (SELECT id FROM games WHERE slug = 'pokemon')
`);
const updateStmt = db.prepare(`UPDATE cards SET variant_flags = ? WHERE id = ?`);

export async function refreshVariantFlags() {
  const [normal, reverse, holo] = [await idsWith("normal"), await idsWith("reverse"), await idsWith("holo")];
  if (!normal.size && !reverse.size && !holo.size) throw new Error("TCGdex lieferte keine Ausführungen");

  let n = 0;
  const batch = [];
  for (const c of cardsStmt.all()) {
    const tid = await tcgdexCardId(c.set_name, c.number, c.name, c.set_id);
    if (!tid) continue; // unbekannt: Anzeige bleibt wie bisher
    batch.push([JSON.stringify({ normal: normal.has(tid), reverse: reverse.has(tid), holo: holo.has(tid) }), c.id]);
    n++;
  }
  db.transaction(() => batch.forEach((row) => updateStmt.run(...row)))();
  console.log(`[varianten] Ausführungen für ${n} Karten gespeichert.`);
  return n;
}

// Einmal nach dem Deploy im Hintergrund nachholen (sonst gäbe es die Angaben
// erst nach dem nächsten Nachtlauf); danach hält der Nachtlauf sie aktuell.
export function catchUpVariantFlags() {
  const done = db.prepare(`SELECT value FROM app_meta WHERE key = 'variant_flags_v1'`).get();
  if (done) return;
  setTimeout(async () => {
    try {
      await refreshVariantFlags();
      db.prepare(`INSERT OR REPLACE INTO app_meta (key, value) VALUES ('variant_flags_v1', '1')`).run();
    } catch (e) {
      console.error("[varianten] Nachholen fehlgeschlagen (wird nachts erneut versucht):", e.message);
    }
  }, 20_000);
}
