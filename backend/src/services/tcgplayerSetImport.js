import db from "../db/index.js";

// Neue Sets, die TCGdex noch nicht kennt, aus den TCGplayer-Daten von tcgcsv.com (Justus 07.11.2026: Delta Reign war
// am Erscheinungstag bei TCGplayer, bei TCGdex noch nicht - "immer automatisch aktualisieren, wenn ein neues Set
// rauskommt"). Läuft im Nachtlauf direkt nach dem TCGdex-Neu-Check (newCardsSync.js).
//
// Nur Haupt-Sets mit Kürzel ("ME06: Delta Reign", "SV10: ...", "ME02.5: ..."), erschienen in den letzten 210 Tagen.
// Unsere ID folgt dem Kürzel wie bei den bisherigen Sets: ME06 -> me6, ME02.5 -> me2pt5, Karten me6-<Nummer>.
// Kommt das Set später zu TCGdex (dort me06), erkennt newCardsSync es als vorhanden (ID-Varianten + Name) - es
// entsteht nichts doppelt. Bilder wie bei den anderen neuen Sets von scrydex (sonst TCGplayer), Ausführungen
// (Normal/Reverse Holo/Holo) aus den TCGplayer-Preiszeilen, bis TCGdex sie liefert (variantFlags.js).
// Preise kommen wie immer aus Cardmarkets Preisliste (guidePrices.js findet die Cardmarket-Erweiterung über
// Name + Angriffe).
const TCGCSV = "https://tcgcsv.com/tcgplayer/3"; // 3 = Pokémon
const UA = { "User-Agent": "mycardfolio/1.0 (+https://mycardfolio.de)" };
const MAX_AGE_DAYS = 210;
const CODE_NAME = /^([A-Z]{2,4})(\d{1,2})(?:\.(\d))?:\s*(.+)$/;
const COST = { G: "Grass", R: "Fire", W: "Water", L: "Lightning", P: "Psychic", F: "Fighting", D: "Darkness", M: "Metal", N: "Dragon", C: "Colorless", Y: "Fairy" };
const normName = (n) => (n ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
const j = (v) => (v == null ? null : JSON.stringify(v));

const gameId = db.prepare(`SELECT id FROM games WHERE slug = 'pokemon'`).get().id;
const setsStmt = db.prepare(`SELECT id, name, series FROM card_sets`);
const insertSet = db.prepare(`
  INSERT INTO card_sets (id, game_id, name, series, printed_total, total, release_date, logo, symbol)
  VALUES (@id, @game_id, @name, @series, @printed_total, @total, @release_date, @logo, @symbol)
`);
const insertCard = db.prepare(`
  INSERT OR IGNORE INTO cards (
    game_id, external_id, name, set_name, set_id, number, rarity, image_small, image_large,
    supertype, subtypes, types, hp, abilities, attacks, weaknesses, resistances, retreat_cost, rules, variant_flags, raw_json
  ) VALUES (
    @game_id, @external_id, @name, @set_name, @set_id, @number, @rarity, @image_small, @image_large,
    @supertype, @subtypes, @types, @hp, @abilities, @attacks, @weaknesses, @resistances, @retreat_cost, @rules, @variant_flags, @raw_json
  )
`);

async function tcgJson(path) {
  await new Promise((r) => setTimeout(r, 250)); // Pause zwischen den Abrufen (Regeln von tcgcsv)
  const res = await fetch(`${TCGCSV}${path}`, { headers: UA, signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`tcgcsv ${path}: HTTP ${res.status}`);
  return (await res.json()).results ?? [];
}

// scrydex liefert für unbekannte Bilder Status 200 mit Platzhalter (Kartenrückseite) - nur per Größe erkennbar
const SCRYDEX_PLACEHOLDER = new Set([45551, 186316]);
async function scrydexHas(url) {
  try {
    const res = await fetch(url, { method: "HEAD", headers: { "Accept-Encoding": "identity" }, signal: AbortSignal.timeout(10_000) });
    const len = Number(res.headers.get("content-length"));
    return res.ok && len > 0 && !SCRYDEX_PLACEHOLDER.has(len);
  } catch {
    return false;
  }
}

const strip = (html) => String(html ?? "").replace(/<br\s*\/?>/gi, " ").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

// "[WCC] Gentle Slap (100)<br> Text" -> { name, cost, damage, text }
function parseAttack(s) {
  const m = String(s).match(/^\s*\[([A-Z+]*)\]\s*([^(<]+?)\s*(?:\(([^)]*)\))?\s*(?:<br\s*\/?>([\s\S]*))?$/i);
  if (!m) return null;
  return { name: m[2].trim(), cost: [...m[1]].map((c) => COST[c] ?? "Colorless"), damage: m[3] ?? "", text: strip(m[4]) };
}

// "Lx2" -> [{ type: "Lightning", value: "×2" }], "F-30" -> [{ type: "Fighting", value: "-30" }]
function parseTypeMod(s) {
  const m = String(s ?? "").match(/^([A-Z])\s*([x×+-]\s*\d+)$/i);
  return m ? [{ type: COST[m[1].toUpperCase()] ?? m[1], value: m[2].replace(/^x/i, "×") }] : null;
}

function mapProduct(p, set, variants) {
  const ext = Object.fromEntries((p.extendedData ?? []).map((e) => [e.name, e.value]));
  const number = String(ext.Number).split("/")[0].replace(/^0+(?=\d)/, "");
  const name = p.name.replace(/\s+-\s+\w+\/\d+.*$/, "").trim(); // "Legendary Summit - 097/103 (Right)"
  const cardType = String(ext["Card Type"] ?? "");
  const text = String(ext.CardText ?? "");
  const ability = text.match(/<strong>\s*Ability:\s*([^<]+)<\/strong>\s*([\s\S]*)/i);
  let supertype = "Pokémon";
  let subtypes = [];
  let types = null;
  let rules = null;
  if (/^Trainer/i.test(cardType)) {
    supertype = "Trainer";
    subtypes = [cardType.replace(/^Trainer\s*-\s*/i, "").replace("Pokemon Tool", "Pokémon Tool")];
    rules = text ? [strip(text)] : null;
  } else if (/Energy/i.test(cardType)) {
    supertype = "Energy";
    subtypes = [/special/i.test(cardType) ? "Special" : "Basic"];
    rules = text ? [strip(text)] : null;
  } else {
    types = [cardType];
    if (ext.Stage) subtypes.push(ext.Stage);
    if (/\bex$/.test(name)) subtypes.push("ex");
    if (/^Mega\s/.test(name)) subtypes.push("MEGA");
  }
  const attacks = ["Attack 1", "Attack 2", "Attack 3"].map((k) => ext[k] && parseAttack(ext[k])).filter(Boolean);
  const v = variants.get(p.productId) ?? new Set();
  return {
    game_id: gameId,
    external_id: `${set.id}-${number}`,
    name,
    set_name: set.name,
    set_id: set.id,
    number,
    rarity: ext.Rarity ?? null,
    image_small: null,
    image_large: null,
    supertype,
    subtypes: j(subtypes.length ? subtypes : null),
    types: j(types),
    hp: ext.HP ? String(ext.HP) : null,
    abilities: j(ability ? [{ name: ability[1].trim(), text: strip(ability[2]), type: "Ability" }] : []),
    attacks: j(attacks),
    weaknesses: j(parseTypeMod(ext.Weakness)),
    resistances: j(parseTypeMod(ext.Resistance)),
    retreat_cost: j(ext.RetreatCost ? Array(Number(ext.RetreatCost)).fill("Colorless") : null),
    rules: j(rules),
    variant_flags: v.size ? JSON.stringify({ normal: v.has("Normal"), reverse: v.has("Reverse Holofoil"), holo: v.has("Holofoil") }) : null,
    raw_json: JSON.stringify({ source: "tcgplayer", productId: p.productId, image: p.imageUrl }),
    tcgImage: p.imageUrl,
  };
}

export async function importNewSetsFromTcgplayer({ covered = new Set(), tcgdexNames = new Set(), dryRun = false } = {}) {
  const ours = setsStmt.all();
  const ourIds = new Set(ours.map((s) => s.id));
  const ourNames = new Set(ours.map((s) => normName(s.name)));
  const cutoff = new Date(Date.now() - MAX_AGE_DAYS * 86400000).toISOString().slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);

  const groups = await tcgJson("/groups");
  const fresh = [];
  for (const g of groups) {
    const m = String(g.name).match(CODE_NAME);
    const released = String(g.publishedOn ?? "").slice(0, 10);
    if (!m || !released || released < cutoff || released > today) continue;
    const id = `${m[1].toLowerCase()}${Number(m[2])}${m[3] ? `pt${m[3]}` : ""}`;
    const name = m[4].trim();
    // TCGdex kennt das Set schon: dann importiert es der TCGdex-Weg (vollständigere Daten)
    if (ourIds.has(id) || covered.has(id) || ourNames.has(normName(name)) || tcgdexNames.has(normName(name))) continue;
    // gleiches Kürzel wie ein Set, das wir schon haben (z. B. "me" für Mega Evolution): Serie übernehmen
    const sibling = ours.find((s) => s.id.replace(/\d.*$/, "") === m[1].toLowerCase());
    if (!sibling) continue; // neue Serie: lieber auf TCGdex warten als eine falsche ID vergeben
    fresh.push({ groupId: g.groupId, id, name, series: sibling.series, released });
  }
  console.log(`[newCards] TCGplayer: neue Sets ${fresh.map((s) => `${s.id} (${s.name})`).join(", ") || "-"}`);
  if (dryRun || !fresh.length) return fresh.map((s) => s.id);

  const imported = [];
  for (const s of fresh) {
    try {
      const products = (await tcgJson(`/${s.groupId}/products`)).filter((p) => (p.extendedData ?? []).some((e) => e.name === "Number"));
      const variants = new Map();
      for (const r of await tcgJson(`/${s.groupId}/prices`)) {
        if (!variants.has(r.productId)) variants.set(r.productId, new Set());
        variants.get(r.productId).add(r.subTypeName);
      }
      const cards = [];
      const seen = new Set();
      for (const p of products) {
        const c = mapProduct(p, s, variants);
        if (!c.number || seen.has(c.external_id)) continue; // Codekarten u. Ä. ohne Nummer, doppelte Nummern
        seen.add(c.external_id);
        cards.push(c);
      }
      if (cards.length < 20) {
        console.log(`[newCards] TCGplayer ${s.id}: nur ${cards.length} Karten - noch nicht vollständig, übersprungen.`);
        continue;
      }
      for (const c of cards) {
        const base = `https://images.scrydex.com/pokemon/${c.external_id}`;
        const scrydex = await scrydexHas(`${base}/small`);
        c.image_small = scrydex ? `${base}/small` : c.tcgImage?.replace("_200w", "_400w") ?? null;
        c.image_large = scrydex ? `${base}/large` : c.tcgImage?.replace("_200w", "_in_1000x1000") ?? null;
      }
      const logo = `https://images.scrydex.com/pokemon/${s.id}-logo/logo`;
      const symbol = `https://images.scrydex.com/pokemon/${s.id}-symbol/symbol`;
      const printed = Number(String(products[0]?.extendedData?.find((e) => e.name === "Number")?.value ?? "").split("/")[1]) || null;
      const set = {
        id: s.id,
        game_id: gameId,
        name: s.name,
        series: s.series,
        printed_total: printed,
        total: cards.length,
        release_date: s.released.replace(/-/g, "/"),
        logo: (await scrydexHas(logo)) ? logo : null,
        symbol: (await scrydexHas(symbol)) ? symbol : null,
      };
      db.transaction(() => {
        insertSet.run(set);
        for (const { tcgImage, ...c } of cards) insertCard.run(c);
      })();
      console.log(`[newCards] TCGplayer: ${s.name} (${s.id}) mit ${cards.length} Karten angelegt.`);
      imported.push(s.id);
    } catch (e) {
      console.error(`[newCards] TCGplayer-Import ${s.id} fehlgeschlagen:`, e.message);
    }
  }
  return imported;
}
