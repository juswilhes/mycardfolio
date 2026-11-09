import db from "../db/index.js";
import { tcgdexSetId } from "./priceProvider.js";

// Deutsche Set-Namen (Justus 09.11.2026: "Mega Entwicklung Display" fand nichts, weil unser Set "Mega Evolution" heißt).
// Quelle TCGdex (deutsche Setliste); unser Set wird über tcgdexSetId() (ID-Varianten + englischer Name) dem
// TCGdex-Set zugeordnet. Gespeichert in card_sets.name_de, nur für die Suche - der angezeigte Name bleibt englisch.
// Nur wenn der deutsche Name wirklich anders lautet (sonst ist die Spalte leer).
const UA = { "User-Agent": "MyCardfolio/1.0" };

export async function refreshGermanSetNames() {
  const res = await fetch("https://api.tcgdex.net/v2/de/sets", { headers: UA, signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const de = new Map((await res.json()).map((s) => [s.id, s.name]));
  if (!de.size) return 0;

  const upd = db.prepare(`UPDATE card_sets SET name_de = ? WHERE id = ?`);
  let changed = 0;
  for (const s of db.prepare(`SELECT id, name, name_de FROM card_sets`).all()) {
    const tid = await tcgdexSetId(s.name, s.id);
    const nameDe = tid ? de.get(tid) : null;
    if (nameDe && nameDe !== s.name && nameDe !== s.name_de) {
      upd.run(nameDe, s.id);
      changed++;
    }
  }
  console.log(`[set-namen] ${changed} deutsche Set-Namen gespeichert.`);
  return changed;
}

// Einmal nach dem Deploy (Marker), damit die Suche nicht erst nach dem nächsten Nachtlauf deutsch kann
export function catchUpGermanSetNames() {
  if (db.prepare(`SELECT value FROM app_meta WHERE key = 'set_names_de_v1'`).get()) return;
  setTimeout(async () => {
    try {
      await refreshGermanSetNames();
      db.prepare(`INSERT OR REPLACE INTO app_meta (key, value) VALUES ('set_names_de_v1', '1')`).run();
    } catch (e) {
      console.error("[set-namen] Nachholen fehlgeschlagen (wird nachts erneut versucht):", e.message);
    }
  }, 90_000);
}
