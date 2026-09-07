// Baut die Deutsch->Englisch-Namensliste für die Kartensuche.
// Quelle: PokéAPI-CSV (pokemon_species_names.csv). Läuft selten:
//   npm run build-de-names
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "..", "data", "pokemon-de-en.json");
const CSV = "https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/pokemon_species_names.csv";

const LANG_DE = "6";
const LANG_EN = "9";

const res = await fetch(CSV);
if (!res.ok) throw new Error(`Download fehlgeschlagen: ${res.status}`);
const text = await res.text();

const de = new Map(); // species_id -> deutscher Name
const en = new Map(); // species_id -> englischer Name

for (const line of text.split("\n").slice(1)) {
  if (!line.trim()) continue;
  const [id, lang, name] = line.split(",");
  if (lang === LANG_DE) de.set(id, name.trim());
  else if (lang === LANG_EN) en.set(id, name.trim());
}

const map = {};
for (const [id, deName] of de) {
  const enName = en.get(id);
  if (enName && deName && deName.toLowerCase() !== enName.toLowerCase()) {
    map[deName.toLowerCase()] = enName;
  }
}

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(map, null, 0));
console.log(`${Object.keys(map).length} deutsche Namen -> ${OUT}`);
