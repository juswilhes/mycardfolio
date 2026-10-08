import db from "../db/index.js";

// Karten ohne (funktionierendes) Bild reparieren. Bild-Adressen kommen aus
// mehreren Quellen (pokemontcg.io, TCGdex, scrydex) und werden mit der Zeit
// ungültig bzw. fehlen bei brandneuen Karten.
//
// WICHTIG: scrydex antwortet bei Karten, die es dort (noch) nicht gibt, NICHT
// mit 404, sondern mit Status 200 und einem Platzhalterbild (Kartenrückseite,
// immer dieselbe Datei). "Erreichbar" reicht deshalb nicht - die bekannten
// Platzhalter-Dateigrößen gelten als "kein Bild".
//
// Quellen in dieser Reihenfolge:
//   1. scrydex   https://images.scrydex.com/pokemon/<Karten-ID>/small|large
//   2. offizielle Pokémon-Kartendatenbank (245x342 PNG, ein Format für beides)
//      .../cards/web/<SET>/<SET>_EN_<Nummer>.png - nur bei rein numerischen
//      Kartennummern; deckt u.a. MEP, MEE, 30th Celebration ab

const SCRYDEX_PLACEHOLDER_BYTES = new Set([45551, 186316]); // small, large
const OFFICIAL = "https://assets.pokemon.com/static-assets/content-assets/cms2/img/cards/web";
const CONCURRENCY = 10;

const scrydex = (id, size) => `https://images.scrydex.com/pokemon/${encodeURIComponent(id)}/${size}`;

function officialUrl(c) {
  const num = String(c.number ?? "").replace(/^0+(?=\d)/, "");
  if (!c.set_id || !/^\d+$/.test(num)) return null;
  const code = c.set_id.toUpperCase();
  return `${OFFICIAL}/${code}/${code}_EN_${num}.png`;
}

// true nur, wenn die Adresse erreichbar ist UND kein bekanntes Platzhalterbild.
async function good(url) {
  if (!url) return false;
  try {
    // identity: sonst antwortet der Server gzip-komprimiert und schickt keine
    // Content-Length - ohne die lässt sich der Platzhalter nicht erkennen.
    const res = await fetch(url, {
      method: "HEAD",
      headers: { "Accept-Encoding": "identity" },
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return false;
    return !SCRYDEX_PLACEHOLDER_BYTES.has(Number(res.headers.get("content-length") || 0));
  } catch {
    return false;
  }
}

async function findImages(c) {
  const small = scrydex(c.external_id, "small");
  if (await good(small)) {
    const large = scrydex(c.external_id, "large");
    return { small, large: (await good(large)) ? large : small };
  }
  const official = officialUrl(c);
  if (official && (await good(official))) return { small: official, large: official };
  return null;
}

// Normal (nachts): Karten ohne Bild, TCGdex-Bilder (fehlen bei neuen Karten
// oft) und scrydex-Bilder (können Platzhalter sein bzw. später echt werden).
// full: ALLE Karten prüfen (einmalig nach Änderungen an der Prüfung, siehe
// scheduleImageRepair) - sonst wären es jede Nacht 20.000 Anfragen.
const candidatesStmt = db.prepare(`
  SELECT id, external_id, set_id, number, image_small FROM cards
  WHERE image_small IS NULL OR image_small = ''
     OR image_small LIKE 'https://assets.tcgdex.net/%'
     OR image_small LIKE 'https://images.scrydex.com/%'
     OR image_small LIKE 'https://assets.pokemon.com/%'
`);
const allStmt = db.prepare(`SELECT id, external_id, set_id, number, image_small FROM cards`);
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
        if (await good(c.image_small)) continue;
        broken++;
        const found = await findImages(c);
        if (found && found.small !== c.image_small) {
          updateStmt.run(found.small, found.large, c.id);
          fixed++;
        }
      }
    }
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
    console.log(`[imageRepair] ${cards.length} Karten geprüft, ${broken} ohne echtes Bild, ${fixed} repariert, ${broken - fixed} ohne Ersatz.`);
    return { checked: cards.length, broken, fixed };
  } finally {
    running = false;
  }
}

// Einmalige Vollprüfung kurz nach dem ersten Start mit dieser Prüflogik
// (Marker in app_meta; bei Änderungen an der Logik die Versionsnummer hoch-
// zählen, dann läuft sie einmal neu). Danach übernimmt der Nachtlauf.
// v2: Platzhalterbilder von scrydex zählen jetzt als "kein Bild".
export function scheduleImageRepair() {
  const key = "image_full_check_v2";
  if (db.prepare(`SELECT 1 FROM app_meta WHERE key = ?`).get(key)) return;
  setTimeout(() => {
    repairImages({ full: true })
      .then((r) => {
        if (r) db.prepare(`INSERT OR REPLACE INTO app_meta (key, value) VALUES (?, ?)`).run(key, new Date().toISOString());
      })
      .catch((e) => console.error("[imageRepair] Vollprüfung fehlgeschlagen:", e));
  }, 60 * 1000);
}
