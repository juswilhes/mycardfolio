// Importiert einzelne Sets aus der TCGdex-API, die im pokemon-tcg-data-
// Datensatz (noch) fehlen - z.B. die Mega-Evolution-Promos.
//
//   npm run import-tcgdex                 -> Standard: mep, mee
//   npm run import-tcgdex -- mep mee sv10 -> beliebige TCGdex-Set-IDs
//
// Danach ganz normal in Suche und "Alle Karten" verfügbar. Illustratoren,
// die per Backfill/manuell gesetzt wurden, bleiben erhalten.

import db from "../db/index.js";
import { recordPrices } from "../services/cardService.js";

const API = "https://api.tcgdex.net/v2/en";
const gameId = db.prepare(`SELECT id FROM games WHERE slug = 'pokemon'`).get().id;
const j = (v) => (v == null ? null : JSON.stringify(v));

const setIds = process.argv.slice(2).length ? process.argv.slice(2) : ["mep", "mee"];

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
    supertype, subtypes, types, hp, artist, artist_source, flavor_text, national_pokedex, evolves_from,
    abilities, attacks, weaknesses, resistances, retreat_cost, rules, legalities, regulation_mark,
    cardmarket_product_id, raw_json
  ) VALUES (
    @game_id, @external_id, @name, @set_name, @set_id, @number, @rarity, @image_small, @image_large,
    @supertype, @subtypes, @types, @hp, @artist, @artist_source, @flavor_text, @national_pokedex, @evolves_from,
    @abilities, @attacks, @weaknesses, @resistances, @retreat_cost, @rules, @legalities, @regulation_mark,
    @cardmarket_product_id, @raw_json
  )
  ON CONFLICT(game_id, external_id) DO UPDATE SET
    name=excluded.name, set_name=excluded.set_name, set_id=excluded.set_id, number=excluded.number,
    rarity=excluded.rarity, image_small=excluded.image_small, image_large=excluded.image_large,
    supertype=excluded.supertype, subtypes=excluded.subtypes, types=excluded.types, hp=excluded.hp,
    flavor_text=excluded.flavor_text, national_pokedex=excluded.national_pokedex,
    evolves_from=excluded.evolves_from, abilities=excluded.abilities, attacks=excluded.attacks,
    weaknesses=excluded.weaknesses, resistances=excluded.resistances, retreat_cost=excluded.retreat_cost,
    rules=excluded.rules, legalities=excluded.legalities, regulation_mark=excluded.regulation_mark,
    cardmarket_product_id=excluded.cardmarket_product_id, raw_json=excluded.raw_json,
    artist = CASE
      WHEN cards.artist_manual = 1 THEN cards.artist
      WHEN excluded.artist IS NOT NULL AND excluded.artist <> '' THEN excluded.artist
      ELSE cards.artist
    END,
    artist_source = CASE
      WHEN cards.artist_manual = 1 THEN cards.artist_source
      WHEN excluded.artist IS NOT NULL AND excluded.artist <> '' THEN 'tcgdex'
      ELSE cards.artist_source
    END
`);

const cardIdByExt = db.prepare(
  `SELECT id FROM cards WHERE external_id = ? AND game_id = ${gameId}`
);

const STAGE = { basic: "Basic", stage1: "Stage 1", stage2: "Stage 2" };
const SUPERTYPE = { pokemon: "Pokémon", trainer: "Trainer", energy: "Energy" };
const img = (base, q) => (base ? `${base}/${q}.webp` : null);

// TCGdex liefert bei sehr neuen Sets kein image-Feld, die Bilder liegen aber
// unter assets.tcgdex.net/en/<serie>/<set>/<localId>/{low|high}.webp.
function imageBase(c, serieId) {
  if (c.image) return c.image;
  if (serieId && c.set?.id && c.localId && /\d/.test(c.localId)) {
    return `https://assets.tcgdex.net/en/${serieId}/${c.set.id}/${c.localId}`;
  }
  return null;
}

function mapCard(c, setName, serieId) {
  const base = imageBase(c, serieId);
  const cat = (c.category ?? "").toLowerCase();
  const subtypes = [];
  if (cat === "pokemon" && c.stage) subtypes.push(STAGE[c.stage.toLowerCase()] ?? c.stage);
  if (cat === "trainer" && c.trainerType) subtypes.push(c.trainerType);
  if (cat === "energy" && c.energyType) subtypes.push(c.energyType);

  const legal = {};
  if (c.legal?.standard) legal.standard = "Legal";
  if (c.legal?.expanded) legal.expanded = "Legal";

  const cm = c.pricing?.cardmarket;

  return {
    game_id: gameId,
    external_id: c.id,
    name: c.name,
    set_name: c.set?.name ?? setName ?? null,
    set_id: c.set?.id ?? null,
    number: c.localId ?? null,
    rarity: c.rarity ?? null,
    image_small: img(base, "low"),
    image_large: img(base, "high"),
    supertype: SUPERTYPE[cat] ?? c.category ?? null,
    subtypes: j(subtypes.length ? subtypes : null),
    types: j(c.types ?? null),
    hp: c.hp != null ? String(c.hp) : null,
    artist: c.illustrator ?? null,
    artist_source: c.illustrator ? "tcgdex" : null,
    flavor_text: c.description ?? null,
    national_pokedex: j(c.dexId ?? null),
    evolves_from: c.evolveFrom ?? null,
    abilities: j(
      (c.abilities ?? []).map((a) => ({ name: a.name, text: a.effect, type: a.type })) || null
    ),
    attacks: j(
      (c.attacks ?? []).map((a) => ({
        name: a.name,
        cost: a.cost ?? [],
        damage: a.damage != null ? String(a.damage) : "",
        text: a.effect ?? "",
      }))
    ),
    weaknesses: j(c.weaknesses ?? null),
    resistances: j(c.resistances ?? null),
    retreat_cost: j(c.retreat ? Array(c.retreat).fill("Colorless") : null),
    rules: j(c.rules ?? null),
    legalities: j(Object.keys(legal).length ? legal : null),
    regulation_mark: c.regulationMark ?? null,
    cardmarket_product_id:
      cm?.idProduct ?? c.variants_detailed?.[0]?.thirdParty?.cardmarket ?? null,
    raw_json: JSON.stringify(c),
  };
}

function priceRows(c) {
  const cm = c.pricing?.cardmarket;
  if (!cm) return [];
  const mk = (variant, priceType, price) =>
    price != null && price > 0
      ? { source: "cardmarket", variant, price_type: priceType, currency: "EUR", price: Math.round(price * 100) / 100 }
      : null;
  return [
    mk("normal", "trend", cm.trend),
    mk("normal", "low", cm.low),
    mk("normal", "avg30", cm.avg30),
    mk("holo", "trend", cm["trend-holo"]),
    mk("holo", "low", cm["low-holo"]),
    mk("holo", "avg30", cm["avg30-holo"]),
  ].filter(Boolean);
}

for (const sid of setIds) {
  const set = await fetchJson(`${API}/sets/${sid}`);
  if (!set) {
    console.log(`  ${sid}: nicht gefunden - übersprungen`);
    continue;
  }
  upsertSet.run({
    id: set.id,
    game_id: gameId,
    name: set.name,
    series: set.serie?.name ?? null,
    printed_total: set.cardCount?.official ?? null,
    total: set.cardCount?.total ?? set.cards?.length ?? null,
    release_date: set.releaseDate ? set.releaseDate.replace(/-/g, "/") : null,
    logo: set.logo ? `${set.logo}.webp` : null,
    symbol: set.symbol ? `${set.symbol}.webp` : null,
  });

  const serieId = set.serie?.id ?? null;
  const brief = set.cards ?? [];
  console.log(`  ${set.name} (${sid}): ${brief.length} Karten ...`);
  let n = 0;
  for (const b of brief) {
    try {
      const full = await fetchJson(`${API}/cards/${b.id}`);
      if (!full) continue;
      upsertCard.run(mapCard(full, set.name, serieId));
      const row = cardIdByExt.get(b.id);
      if (row) recordPrices(row.id, priceRows(full));
      n++;
      if (n % 25 === 0) console.log(`    ... ${n}/${brief.length}`);
    } catch (err) {
      console.error(`    Fehler bei ${b.id}: ${err.message}`);
    }
    await new Promise((r) => setTimeout(r, 120));
  }
  console.log(`  ${set.name}: ${n} Karten importiert.`);
}

console.log("Fertig.");
