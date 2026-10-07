import cron from "node-cron";
import db from "../db/index.js";
import { getSetValueAnalysis } from "./marketStats.js";

// Monatlicher Stand der Analyse "Booster/Box vs. Top-20-Karten" - Grundlage
// für den Verlauf. Karten- und Boosterpreise ändern sich laufend; ohne
// gespeicherte Stände ließe sich später nichts mehr vergleichen.

const upsertStmt = db.prepare(`
  INSERT INTO set_value_snapshots
    (set_id, month, captured_on, box_price_cents, booster_price_cents, top20_value, top20_count)
  VALUES (@set_id, @month, @captured_on, @box, @booster, @top20_value, @top20_count)
  ON CONFLICT(set_id, month) DO UPDATE SET
    captured_on = excluded.captured_on,
    box_price_cents = excluded.box_price_cents,
    booster_price_cents = excluded.booster_price_cents,
    top20_value = excluded.top20_value,
    top20_count = excluded.top20_count
`);
const monthsWithSnapshotStmt = db.prepare(`SELECT set_id FROM set_value_snapshots WHERE month = ?`);

// Schreibt den Stand dieses Monats für alle Sets mit hinterlegtem Preis
// (onlyMissing: nur die, für die es diesen Monat noch keinen gibt) bzw. nur
// für ein Set (nach einer Preisänderung durch den Betreiber).
export function recordSetValueSnapshots({ onlyMissing = false, setId = null } = {}) {
  const now = new Date().toISOString();
  const month = now.slice(0, 7);
  const have = onlyMissing ? new Set(monthsWithSnapshotStmt.all(month).map((r) => r.set_id)) : new Set();

  let n = 0;
  for (const s of getSetValueAnalysis()) {
    if (setId && s.id !== setId) continue;
    if (have.has(s.id)) continue;
    if (!s.top20Count) continue; // ohne bepreiste Karten gibt es nichts zu vergleichen
    upsertStmt.run({
      set_id: s.id,
      month,
      captured_on: now.slice(0, 10),
      box: s.boxPriceCents,
      booster: s.boosterPriceCents,
      top20_value: s.top20Value,
      top20_count: s.top20Count,
    });
    n++;
  }
  return n;
}

// Am 1. jedes Monats um 4 Uhr (nach dem nächtlichen Preis-Sweep um 3 Uhr).
// Zusätzlich beim Start nachholen, was in diesem Monat noch fehlt - sonst
// fehlt ein Monat, wenn der Server genau am 1. nicht lief, und der erste
// Stand entsteht direkt nach dem Deploy statt erst zum nächsten Monatsersten.
export function scheduleSetValueSnapshots() {
  cron.schedule("0 4 1 * *", () => {
    try {
      const n = recordSetValueSnapshots();
      console.log(`[setValue] Monatsstand gespeichert (${n} Sets).`);
    } catch (e) {
      console.error("[setValue] Monatsstand fehlgeschlagen:", e);
    }
  });
  try {
    const n = recordSetValueSnapshots({ onlyMissing: true });
    if (n) console.log(`[setValue] Fehlenden Monatsstand nachgeholt (${n} Sets).`);
  } catch (e) {
    console.error("[setValue] Nachholen fehlgeschlagen:", e);
  }
  console.log("[setValue] Monatsstand am 1. um 4 Uhr eingeplant.");
}
