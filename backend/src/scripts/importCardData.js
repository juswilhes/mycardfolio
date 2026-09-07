// Einmal-Import (bzw. bei Updates erneut ausführbar): liest den lokal
// geklonten Pokemon-Datensatz und schreibt Sets + alle Karten in die
// SQLite-DB. Danach laufen Suche und "Alle Karten" komplett offline und
// sofort - keine Live-API-Aufrufe mehr für Kartendaten.
//
// Datensatz: https://github.com/PokemonTCG/pokemon-tcg-data  (nur EN-Karten)
// Aktualisieren:  cd backend/vendor/pokemon-tcg-data && git pull
// Import starten:  npm run import          (aus dem backend-Ordner)

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import db from "../db/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "..", "vendor", "pokemon-tcg-data");
const SETS_FILE = path.join(DATA_DIR, "sets", "en.json");
const CARDS_DIR = path.join(DATA_DIR, "cards", "en");

if (!fs.existsSync(SETS_FILE)) {
  console.error(`Datensatz nicht gefunden unter ${DATA_DIR}`);
  console.error("Erst klonen:  git clone --depth 1 https://github.com/PokemonTCG/pokemon-tcg-data.git backend/vendor/pokemon-tcg-data");
  process.exit(1);
}

const gameId = db.prepare(`SELECT id FROM games WHERE slug = 'pokemon'`).get().id;
const j = (v) => (v == null ? null : JSON.stringify(v));

const upsertSet = db.prepare(`
  INSERT INTO card_sets (id, game_id, name, series, printed_total, total, release_date, logo, symbol)
  VALUES (@id, @game_id, @name, @series, @printed_total, @total, @release_date, @logo, @symbol)
  ON CONFLICT(id) DO UPDATE SET
    name=excluded.name, series=excluded.series, printed_total=excluded.printed_total,
    total=excluded.total, release_date=excluded.release_date, logo=excluded.logo, symbol=excluded.symbol
`);

const upsertCard = db.prepare(`
  INSERT INTO cards (
    game_id, external_id, name, set_name, set_id, number, rarity, image_small, image_large,
    supertype, subtypes, types, hp, artist, flavor_text, national_pokedex, evolves_from,
    abilities, attacks, weaknesses, resistances, retreat_cost, rules, legalities, regulation_mark, raw_json
  ) VALUES (
    @game_id, @external_id, @name, @set_name, @set_id, @number, @rarity, @image_small, @image_large,
    @supertype, @subtypes, @types, @hp, @artist, @flavor_text, @national_pokedex, @evolves_from,
    @abilities, @attacks, @weaknesses, @resistances, @retreat_cost, @rules, @legalities, @regulation_mark, @raw_json
  )
  ON CONFLICT(game_id, external_id) DO UPDATE SET
    name=excluded.name, set_name=excluded.set_name, set_id=excluded.set_id, number=excluded.number,
    rarity=excluded.rarity, image_small=excluded.image_small, image_large=excluded.image_large,
    supertype=excluded.supertype, subtypes=excluded.subtypes, types=excluded.types, hp=excluded.hp,
    artist=excluded.artist, flavor_text=excluded.flavor_text, national_pokedex=excluded.national_pokedex,
    evolves_from=excluded.evolves_from, abilities=excluded.abilities, attacks=excluded.attacks,
    weaknesses=excluded.weaknesses, resistances=excluded.resistances, retreat_cost=excluded.retreat_cost,
    rules=excluded.rules, legalities=excluded.legalities, regulation_mark=excluded.regulation_mark,
    raw_json=excluded.raw_json
`);

// --- Sets ---------------------------------------------------------------
const sets = JSON.parse(fs.readFileSync(SETS_FILE, "utf8"));
const setNameById = new Map();
const importSets = db.transaction((rows) => {
  for (const s of rows) {
    setNameById.set(s.id, s.name);
    upsertSet.run({
      id: s.id,
      game_id: gameId,
      name: s.name,
      series: s.series ?? null,
      printed_total: s.printedTotal ?? null,
      total: s.total ?? null,
      release_date: s.releaseDate ?? null,
      logo: s.images?.logo ?? null,
      symbol: s.images?.symbol ?? null,
    });
  }
});
importSets(sets);
console.log(`Sets importiert: ${sets.length}`);

// --- Karten -----------------------------------------------------------
let total = 0;
const files = fs.readdirSync(CARDS_DIR).filter((f) => f.endsWith(".json"));
const importCards = db.transaction((cards, setId) => {
  for (const c of cards) {
    upsertCard.run({
      game_id: gameId,
      external_id: c.id,
      name: c.name,
      set_name: c.set?.name ?? setNameById.get(setId) ?? null,
      set_id: c.set?.id ?? setId,
      number: c.number ?? null,
      rarity: c.rarity ?? null,
      image_small: c.images?.small ?? null,
      image_large: c.images?.large ?? null,
      supertype: c.supertype ?? null,
      subtypes: j(c.subtypes),
      types: j(c.types),
      hp: c.hp ?? null,
      artist: c.artist ?? null,
      flavor_text: c.flavorText ?? null,
      national_pokedex: j(c.nationalPokedexNumbers),
      evolves_from: c.evolvesFrom ?? null,
      abilities: j(c.abilities),
      attacks: j(c.attacks),
      weaknesses: j(c.weaknesses),
      resistances: j(c.resistances),
      retreat_cost: j(c.retreatCost),
      rules: j(c.rules),
      legalities: j(c.legalities),
      regulation_mark: c.regulationMark ?? null,
      raw_json: JSON.stringify(c),
    });
    total++;
  }
});

for (const file of files) {
  const setId = path.basename(file, ".json");
  const cards = JSON.parse(fs.readFileSync(path.join(CARDS_DIR, file), "utf8"));
  importCards(cards, setId);
}

console.log(`Karten importiert/aktualisiert: ${total}`);
console.log("Fertig. Suche und 'Alle Karten' laufen jetzt lokal.");
