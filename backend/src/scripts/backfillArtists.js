// Füllt fehlende Illustrator-Angaben aus der TCGdex-API nach
// (https://tcgdex.dev - frei, mehrsprachig). Der Basis-Datensatz von
// pokemon-tcg-data hat bei den neuesten Sets oft noch keinen Artist;
// TCGdex kennt ihn meist trotzdem.
//
// Aufruf:  npm run backfill-artists          (aus dem backend-Ordner)
// Läuft beliebig oft; bereits geholte TCGdex-Antworten werden gecacht.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import db from "../db/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CACHE_FILE = path.join(__dirname, "..", "..", "vendor", "tcgdex-artist-cache.json");
const API = "https://api.tcgdex.net/v2/en";

const cache = fs.existsSync(CACHE_FILE)
  ? JSON.parse(fs.readFileSync(CACHE_FILE, "utf8"))
  : { cards: {}, sets: {} };
const saveCache = () => fs.writeFileSync(CACHE_FILE, JSON.stringify(cache));

const norm = (s) => (s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
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
      await new Promise((r) => setTimeout(r, 500 * (i + 1)));
    }
  }
}

// Namensabweichungen unser card_sets.name  ->  TCGdex-Set-ID.
// Schlüssel werden mit norm() verglichen (nur a-z0-9).
const SET_OVERRIDES = Object.fromEntries(
  Object.entries({
    "Scarlet & Violet Energies": "sve",
    "Scarlet & Violet Black Star Promos": "svp",
    "SWSH Black Star Promos": "swshp",
    "SM Black Star Promos": "smp",
    "Pokémon GO": "pgo",
  }).map(([k, v]) => [norm(k), v])
);

async function resolveTcgdexSets() {
  const list = cache.sets.__list__ ?? (await fetchJson(`${API}/sets`));
  cache.sets.__list__ = list;
  const byName = new Map(list.map((s) => [norm(s.name), s.id]));
  const byId = new Map(list.map((s) => [s.id, s]));
  return { byName, byId, list };
}

async function main() {
  const missing = db
    .prepare(
      `SELECT c.external_id, c.name, c.number, c.set_id, s.name AS set_name
       FROM cards c LEFT JOIN card_sets s ON s.id = c.set_id
       WHERE (c.artist IS NULL OR c.artist = '') AND (c.artist_manual IS NULL OR c.artist_manual = 0)`
    )
    .all();

  console.log(`Karten ohne Illustrator: ${missing.length}`);
  if (!missing.length) return;

  const { byName } = await resolveTcgdexSets();
  const update = db.prepare(
    `UPDATE cards SET artist = ?, artist_source = 'tcgdex' WHERE external_id = ? AND (artist_manual IS NULL OR artist_manual = 0)`
  );

  const bySet = new Map();
  for (const row of missing) {
    if (!bySet.has(row.set_id)) bySet.set(row.set_id, []);
    bySet.get(row.set_id).push(row);
  }

  let filled = 0;
  let done = 0;

  for (const [setId, rows] of bySet) {
    const setName = rows[0].set_name ?? "";
    const tcgSetId = SET_OVERRIDES[norm(setName)] ?? byName.get(norm(setName));
    if (!tcgSetId) {
      console.log(`  ? kein TCGdex-Set für "${setName}" (${setId}) - übersprungen (${rows.length})`);
      done += rows.length;
      continue;
    }

    const tcgSet = cache.sets[tcgSetId] ?? (await fetchJson(`${API}/sets/${tcgSetId}`));
    cache.sets[tcgSetId] = tcgSet;
    const tcgCards = tcgSet?.cards ?? [];
    const byLocalId = new Map(tcgCards.map((c) => [normNum(c.localId), c]));
    const byCardName = new Map();
    for (const c of tcgCards) if (!byCardName.has(norm(c.name))) byCardName.set(norm(c.name), c);

    // in kleinen Häppchen, um die API nicht zu fluten
    const queue = [...rows];
    const workers = Array.from({ length: 6 }, async () => {
      while (queue.length) {
        const row = queue.shift();
        const hit = byLocalId.get(normNum(row.number)) ?? byCardName.get(norm(row.name));
        done++;
        if (!hit) continue;
        let full = cache.cards[hit.id];
        if (full === undefined) {
          full = (await fetchJson(`${API}/cards/${hit.id}`)) ?? null;
          cache.cards[hit.id] = full;
        }
        const illustrator = full?.illustrator?.trim();
        if (illustrator) {
          update.run(illustrator, row.external_id);
          filled++;
        }
        if (done % 100 === 0) {
          console.log(`  ... ${done}/${missing.length} geprüft, ${filled} ergänzt`);
          saveCache();
        }
      }
    });
    await Promise.all(workers);
    saveCache();
    console.log(`  ${setName}: fertig`);
  }

  saveCache();
  const stillMissing = db
    .prepare(`SELECT COUNT(*) n FROM cards WHERE artist IS NULL OR artist = ''`)
    .get().n;
  console.log(`\nErgänzt: ${filled}. Noch ohne Illustrator: ${stillMissing}.`);
  console.log("Die restlichen kannst du in der App pro Karte manuell eintragen.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
