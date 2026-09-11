// Gleicht ein Promo-Set (z.B. "svp"), das ursprünglich aus dem
// pokemon-tcg-data-Datensatz importiert wurde, mit dem aktuellen TCGdex-
// Stand ab. Black-Star-Promos wachsen laufend (neue Nummern kommen über
// Monate dazu); der gitgeclonte pokemon-tcg-data-Datensatz (import.js)
// hinkt dabei oft Monate hinterher, TCGdex ist näher am aktuellen Stand.
//
// Anders als importFromTcgdex.js (für Sets, die NUR bei TCGdex existieren,
// z.B. mep/mee) muss hier die externe ID an das bereits vorhandene Schema
// angepasst werden: pokemon-tcg-data nutzt "svp-1", TCGdex "svp-001" -
// ohne Anpassung würde jede Karte doppelt in der DB landen.
//
//   npm run sync-promo-set -- svp

import db from "../db/index.js";
import { recordPrices } from "../services/cardService.js";

const API = "https://api.tcgdex.net/v2/en";
const gameId = db.prepare(`SELECT id FROM games WHERE slug = 'pokemon'`).get().id;
const j = (v) => (v == null ? null : JSON.stringify(v));

const setId = process.argv[2];
if (!setId) {
  console.error("Set-ID fehlt. Beispiel: npm run sync-promo-set -- svp");
  process.exit(1);
}

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

const cardIdByExt = db.prepare(`SELECT id FROM cards WHERE external_id = ? AND game_id = ${gameId}`);

const STAGE = { basic: "Basic", stage1: "Stage 1", stage2: "Stage 2" };
const SUPERTYPE = { pokemon: "Pokémon", trainer: "Trainer", energy: "Energy" };
const img = (base, q) => (base ? `${base}/${q}.webp` : null);

function imageBase(c, serieId) {
  if (c.image) return c.image;
  if (serieId && c.set?.id && c.localId && /\d/.test(c.localId)) {
    return `https://assets.tcgdex.net/en/${serieId}/${c.set.id}/${c.localId}`;
  }
  return null;
}

// Normalisierte externe ID: ohne führende Nullen, damit sie zum bereits
// vorhandenen Schema aus pokemon-tcg-data passt ("svp-211" statt "svp-211"
// mit führenden Nullen bei kleineren Nummern wie "svp-001" -> "svp-1").
// Nicht-numerische localIds (selten) bleiben unverändert.
function normalizedExternalId(setId, localId) {
  return /^\d+$/.test(localId) ? `${setId}-${parseInt(localId, 10)}` : `${setId}-${localId}`;
}

function mapCard(c, setName, serieId, externalId) {
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
    external_id: externalId,
    name: c.name,
    set_name: setName ?? c.set?.name ?? null,
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

const set = await fetchJson(`${API}/sets/${setId}`);
if (!set) {
  console.error(`Set "${setId}" nicht bei TCGdex gefunden.`);
  process.exit(1);
}

// Name des bereits vorhandenen Sets (aus pokemon-tcg-data) beibehalten,
// falls es ihn schon gibt - TCGdex benennt Promo-Sets teils anders
// ("SVP Black Star Promos" statt "Scarlet & Violet Black Star Promos")
// und das soll sich für Bestandskarten nicht unbemerkt ändern.
const existingSet = db.prepare(`SELECT name FROM card_sets WHERE id = ?`).get(setId);
const setName = existingSet?.name ?? set.name;

upsertSet.run({
  id: set.id,
  game_id: gameId,
  name: setName,
  series: set.serie?.name ?? null,
  printed_total: set.cardCount?.official ?? null,
  total: set.cardCount?.total ?? set.cards?.length ?? null,
  release_date: set.releaseDate ? set.releaseDate.replace(/-/g, "/") : null,
  logo: set.logo ? `${set.logo}.webp` : null,
  symbol: set.symbol ? `${set.symbol}.webp` : null,
});

const serieId = set.serie?.id ?? null;
const brief = set.cards ?? [];
console.log(`${setName} (${setId}): ${brief.length} Karten bei TCGdex, gleiche ab ...`);

let added = 0;
let updated = 0;
for (const b of brief) {
  const extId = normalizedExternalId(setId, b.localId);
  const existed = !!cardIdByExt.get(extId);
  try {
    const full = await fetchJson(`${API}/cards/${b.id}`);
    if (!full) continue;
    upsertCard.run(mapCard(full, setName, serieId, extId));
    const row = cardIdByExt.get(extId);
    if (row) recordPrices(row.id, priceRows(full));
    existed ? updated++ : added++;
  } catch (err) {
    console.error(`  Fehler bei ${b.id}: ${err.message}`);
  }
  await new Promise((r) => setTimeout(r, 120));
}

console.log(`Fertig: ${added} neu, ${updated} aktualisiert.`);
