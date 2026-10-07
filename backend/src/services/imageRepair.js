import db from "../db/index.js";

// Karten ohne (funktionierendes) Bild reparieren. Bild-Adressen kommen aus
// mehreren Quellen (pokemontcg.io, TCGdex, scrydex) und werden mit der Zeit
// ungültig bzw. fehlen bei brandneuen Karten. scrydex liefert unter
//   https://images.scrydex.com/pokemon/<Karten-ID>/small|large
// für praktisch alle Karten ein Bild - dorthin wird umgestellt, wenn das
// bisherige nicht (mehr) erreichbar ist oder ganz fehlt.

const scrydex = (id, size) => `https://images.scrydex.com/pokemon/${encodeURIComponent(id)}/${size}`;
const CONCURRENCY = 8;

async function reachable(url) {
  try {
    const res = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(12000) });
    return res.ok;
  } catch {
    return false;
  }
}

// Normal: Karten ohne Bild + Bilder von TCGdex (die fehlen bei neuen Karten
// oft). full: ALLE Karten prüfen (einmalig nach Einführung, siehe
// scheduleImageRepair) - sonst wären es jede Nacht 20.000 Anfragen.
const candidatesStmt = db.prepare(`
  SELECT id, external_id, image_small FROM cards
  WHERE image_small IS NULL OR image_small = '' OR image_small LIKE 'https://assets.tcgdex.net/%'
`);
const allStmt = db.prepare(`SELECT id, external_id, image_small FROM cards`);
const updateStmt = db.prepare(`UPDATE cards SET image_small = ?, image_large = ? WHERE id = ?`);

let running = false;

export async function repairImages({ full = false } = {}) {
  if (running) return null;
  running = true;
  try {
    const cards = (full ? allStmt : candidatesStmt).all();
    let i = 0;
    let broken = 0;
    let fixed = 0;
    async function worker() {
      while (i < cards.length) {
        const c = cards[i++];
        if (c.image_small && (await reachable(c.image_small))) continue;
        broken++;
        const small = scrydex(c.external_id, "small");
        if (await reachable(small)) {
          updateStmt.run(small, scrydex(c.external_id, "large"), c.id);
          fixed++;
        }
      }
    }
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
    console.log(`[imageRepair] ${cards.length} Karten geprüft, ${broken} ohne Bild, ${fixed} repariert.`);
    return { checked: cards.length, broken, fixed };
  } finally {
    running = false;
  }
}

// Einmalige Vollprüfung kurz nach dem ersten Start mit diesem Code (Markierung
// in app_meta), damit vorhandene Lücken nicht erst nach und nach auffallen.
// Danach übernimmt der Nachtlauf (nur Karten ohne Bild + TCGdex-Bilder).
export function scheduleImageRepair() {
  const key = "image_full_check_v1";
  if (db.prepare(`SELECT 1 FROM app_meta WHERE key = ?`).get(key)) return;
  setTimeout(() => {
    repairImages({ full: true })
      .then((r) => {
        if (r) db.prepare(`INSERT OR REPLACE INTO app_meta (key, value) VALUES (?, ?)`).run(key, new Date().toISOString());
      })
      .catch((e) => console.error("[imageRepair] Vollprüfung fehlgeschlagen:", e));
  }, 2 * 60 * 1000);
}
