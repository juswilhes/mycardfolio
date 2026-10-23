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
  SELECT c.id, c.number, c.name, c.set_id, c.rarity, s.name AS set_name
  FROM cards c LEFT JOIN card_sets s ON s.id = c.set_id
  WHERE c.game_id = (SELECT id FROM games WHERE slug = 'pokemon')
`);
const updateStmt = db.prepare(`UPDATE cards SET variant_flags = ? WHERE id = ?`);

// Lücke bei TCGdex (Justus 23.10.2026, Lapras sm11-36): für ganze Sets (EX Delta Species bis Power Keepers,
// Black & White bis Cosmic Eclipse) fehlt dort die Reverse-Holo-Angabe, obwohl es sie gibt. Erkennung über
// Cardmarket: Hat TCGdex im Set (fast) keine Reverse Holos, aber Cardmarket für mind. 80 % der Common/Uncommon/
// Rare/Rare Holo echte Angebote in der zweiten Spalte (Tiefstpreis vorhanden), bekommen diese Seltenheiten die
// Reverse-Holo-Ausführung. Nur diese Seltenheiten: EX/GX/Ultra/Secret gab es nie als Reverse Holo, und die zweite
// Spalte ist bei Cardmarket auch ohne Reverse Holo oft mit Werten gefüllt (z. B. Base Set) - darum zählen nur Angebote.
const REVERSE_RARITIES = new Set(["common", "uncommon", "rare", "rare holo"]);
const reverseOfferStmt = db.prepare(`
  SELECT 1 FROM price_snapshots
  WHERE card_id = ? AND source = 'cardmarket' AND price_type = 'low' AND variant IN ('holo', 'reverse')
    AND price > 0 AND fetched_at > datetime(?, '-7 days')
  LIMIT 1
`);
const newestCardmarketStmt = db.prepare(`SELECT MAX(fetched_at) AS t FROM price_snapshots WHERE source = 'cardmarket'`);

function addMissingReverse(entries) {
  const newest = newestCardmarketStmt.get()?.t;
  if (!newest) return 0;
  const bySet = new Map();
  for (const e of entries) {
    if (!bySet.has(e.setId)) bySet.set(e.setId, []);
    bySet.get(e.setId).push(e);
  }
  let added = 0;
  for (const list of bySet.values()) {
    if (list.filter((e) => e.flags.reverse).length >= list.length * 0.1) continue; // TCGdex kennt das Set
    const eligible = list.filter((e) => REVERSE_RARITIES.has((e.rarity ?? "").toLowerCase()));
    if (eligible.length < 10) continue;
    const offers = eligible.filter((e) => reverseOfferStmt.get(e.id, newest)).length;
    if (offers < eligible.length * 0.8) continue;
    for (const e of eligible) {
      if (e.flags.reverse) continue;
      e.flags.reverse = true;
      // In diesen Sets führt TCGdex Rare Holo als "normal" - die erste Linie heißt dann richtig "Holo"
      if ((e.rarity ?? "").toLowerCase() === "rare holo" && e.flags.normal && !e.flags.holo) {
        e.flags.normal = false;
        e.flags.holo = true;
      }
      added++;
    }
  }
  return added;
}

export async function refreshVariantFlags() {
  const [normal, reverse, holo] = [await idsWith("normal"), await idsWith("reverse"), await idsWith("holo")];
  if (!normal.size && !reverse.size && !holo.size) throw new Error("TCGdex lieferte keine Ausführungen");

  const entries = [];
  for (const c of cardsStmt.all()) {
    const tid = await tcgdexCardId(c.set_name, c.number, c.name, c.set_id);
    if (!tid) continue; // unbekannt: Anzeige bleibt wie bisher
    entries.push({ id: c.id, setId: c.set_id, rarity: c.rarity, flags: { normal: normal.has(tid), reverse: reverse.has(tid), holo: holo.has(tid) } });
  }
  const added = addMissingReverse(entries);
  db.transaction(() => entries.forEach((e) => updateStmt.run(JSON.stringify(e.flags), e.id)))();
  console.log(`[varianten] Ausführungen für ${entries.length} Karten gespeichert (${added} Reverse Holos aus Cardmarket ergänzt).`);
  return entries.length;
}

// Einmal nach dem Deploy im Hintergrund nachholen (Marker bei Logik-Änderungen hochzählen) (sonst gäbe es die Angaben
// erst nach dem nächsten Nachtlauf); danach hält der Nachtlauf sie aktuell.
export function catchUpVariantFlags() {
  const done = db.prepare(`SELECT value FROM app_meta WHERE key = 'variant_flags_v2'`).get();
  if (done) return;
  setTimeout(async () => {
    try {
      await refreshVariantFlags();
      db.prepare(`INSERT OR REPLACE INTO app_meta (key, value) VALUES ('variant_flags_v2', '1')`).run();
    } catch (e) {
      console.error("[varianten] Nachholen fehlgeschlagen (wird nachts erneut versucht):", e.message);
    }
  }, 20_000);
}
