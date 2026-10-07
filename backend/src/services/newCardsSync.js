import db from "../db/index.js";
import { refreshTcgdexSets, tcgdexSetId } from "./priceProvider.js";
import { importTcgdexSet } from "./tcgdexImport.js";

// Nächtlicher Neu-Check (Teil des Tagesjobs um 1 Uhr): gibt es bei TCGdex
// - komplett neue Sets, die wir noch nicht haben, oder
// - neue Karten in Sets, die wir schon haben (z.B. fortlaufende Promos)?
// Beides wird automatisch importiert.
//
// Sicherheitsnetze gegen Duplikate (Set-IDs unterscheiden sich je Quelle,
// z.B. unser "sv1" = TCGdex "sv01"):
//  - ein TCGdex-Set gilt als vorhanden, wenn die ID passt ODER tcgdexSetId()
//    (ID-Varianten + Namensvergleich) eines unserer Sets darauf zeigt
//  - neue Karten werden nur in Sets nachgeladen, deren ID EXAKT gleich ist
//    (dort sind auch die Karten-IDs gleich), und nur, wenn TCGdex mehr
//    Karten hat als wir
//  - neue Sets werden nur importiert, wenn sie wirklich neu sind (Veröffent-
//    lichung in den letzten ~7 Monaten oder in der Zukunft): ältere, bei uns
//    fehlende Sets (Trainer-Kits, McDonald's, Sonderfälle wie "Pokémon GO" mit
//    anderer ID) sind fast immer nur ein ID-Unterschied und würden Karten
//    doppelt anlegen
//  - Karten werden nur nachgeladen, wenn die TCGdex-Karten-IDs nachweislich zu
//    unseren passen (fehlende ≈ Differenz der Kartenzahlen), sonst übersprungen
//  - digitale Pocket-Sets (Serie "tcgp") werden nie importiert

const API = "https://api.tcgdex.net/v2/en";
const NEW_SET_MAX_AGE_DAYS = 210;
const normName = (n) => (n ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");

async function getJson(url) {
  const res = await fetch(url, { headers: { "User-Agent": "MyCardfolio/1.0" }, signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function syncNewCards({ dryRun = false } = {}) {
  const tcgdexSets = await refreshTcgdexSets();
  if (!tcgdexSets.length) {
    console.log("[newCards] TCGdex-Setliste leer - übersprungen.");
    return { newSets: [], grownSets: [] };
  }

  const ours = db.prepare(`SELECT id, name FROM card_sets`).all();
  const counts = new Map(db.prepare(`SELECT set_id, COUNT(*) n FROM cards GROUP BY set_id`).all().map((r) => [r.set_id, r.n]));
  const ourIds = new Set(ours.map((s) => s.id));
  const ourNames = new Set(ours.map((s) => normName(s.name)));
  const cutoff = new Date(Date.now() - NEW_SET_MAX_AGE_DAYS * 86400000).toISOString().slice(0, 10).replace(/-/g, "");

  const covered = new Set(ourIds);
  for (const s of ours) {
    const t = await tcgdexSetId(s.name, s.id);
    if (t) covered.add(t);
  }

  const newSets = [];
  const grownSets = [];
  for (const t of tcgdexSets) {
    if (!t.cardCount?.total) continue;
    if (!covered.has(t.id)) {
      if (ourNames.has(normName(t.name))) continue;
      // Serie und Datum erkennt man erst am Detail
      let detail;
      try {
        detail = await getJson(`${API}/sets/${t.id}`);
      } catch {
        continue;
      }
      if (detail.serie?.id === "tcgp") continue;
      const released = (detail.releaseDate ?? "").replace(/-/g, "");
      if (!released || released < cutoff) continue;
      newSets.push(t.id);
    } else if (ourIds.has(t.id) && t.cardCount.total > (counts.get(t.id) ?? 0)) {
      let detail;
      try {
        detail = await getJson(`${API}/sets/${t.id}`);
      } catch {
        continue;
      }
      const have = new Set(db.prepare(`SELECT external_id FROM cards WHERE set_id = ?`).all(t.id).map((r) => r.external_id));
      const missing = (detail.cards ?? []).filter((c) => !have.has(c.id)).length;
      const expected = t.cardCount.total - (counts.get(t.id) ?? 0);
      if (missing > expected + 3) {
        console.log(`[newCards] ${t.id}: übersprungen (Karten-IDs passen nicht zu unseren, ${missing} fehlend vs. erwartet ${expected}).`);
        continue;
      }
      grownSets.push(t.id);
    }
  }

  console.log(`[newCards] Neue Sets: ${newSets.join(", ") || "-"} | Sets mit neuen Karten: ${grownSets.join(", ") || "-"}`);
  if (dryRun) return { newSets, grownSets };

  for (const id of newSets) {
    try {
      await importTcgdexSet(id);
    } catch (e) {
      console.error(`[newCards] Import von Set ${id} fehlgeschlagen:`, e.message);
    }
  }
  for (const id of grownSets) {
    try {
      await importTcgdexSet(id, { onlyMissingCards: true });
    } catch (e) {
      console.error(`[newCards] Nachladen für Set ${id} fehlgeschlagen:`, e.message);
    }
  }
  return { newSets, grownSets };
}
