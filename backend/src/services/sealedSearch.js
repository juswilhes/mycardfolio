import db from "../db/index.js";
import { expandQuery } from "./cardRepository.js";

// Suche nach versiegelten Produkten (Justus 09.11.2026: "Sealed in der Suche finden, auf Deutsch und Englisch").
// Die Produktnamen im Katalog (sealed_catalog) sind englisch (TCGplayer). Damit auch deutsche Begriffe treffen
// ("Top-Trainer-Box", "Kollektion", "Themendeck"), wird jedes Suchwort - oder jede feste Wortgruppe - in englische
// Entsprechungen übersetzt. Alle Teile der Suche müssen vorkommen (UND); gesucht wird im Produktnamen sowie im
// Set-Namen, Treffer müssen am Wortanfang liegen ("ex" findet nicht "Complex", aber "Elit" findet "Elite" -
// die Suche läuft schon beim Tippen). Deutsche Set-Namen kennt die App (auch bei den Karten) nicht.

// Akzente/Satzzeichen weg, klein: "Top-Trainer-Box" -> "top trainer box", "Pokémon" -> "pokemon", "Größe" -> "grosse"
const norm = (s) =>
  String(s ?? "")
    .toLowerCase()
    .replace(/ß/g, "ss")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

// Feste Wortgruppen (zuerst geprüft, auf der normalisierten Eingabe). [Muster, englische Entsprechungen]
const PHRASES = [
  [/\b(?:top ?trainer ?box|elite ?trainer ?box|etb)\b/, ["elite trainer box"]],
  [/\b(?:booster ?box|booster ?display|display)\b/, ["booster box", "display"]],
  [/\bbooster ?bundle\b/, ["booster bundle"]],
  [/\b(?:einzel ?booster|booster ?pack(?:ung)?|boosterpack)\b/, ["booster pack"]],
  [/\b(?:booster ?im ?umschlag|sleeved ?booster)\b/, ["sleeved booster"]],
  [/\b(?:themen ?deck|thema ?deck|theme ?deck)\b/, ["theme deck"]],
  [/\b(?:starter ?deck)\b/, ["starter deck"]],
  [/\b(?:turnier ?)?(?:kampf ?deck|battle ?deck)\b/, ["battle deck"]],
  [/\bdeck ?box\b/, ["deck box"]],
  [/\b(?:spiel ?matte|playmat)\b/, ["playmat"]],
  [/\b(?:sammel ?album|binder)\b/, ["binder"]],
  [/\b(?:pre ?release|prerelease|build ?(?:and)? ?battle)\b/, ["prerelease", "build battle"]],
  [/\b(?:mini ?tin|mini ?dose)\b/, ["mini tin"]],
  [/\b(?:3er|dreier|3 ?pack) ?blister\b/, ["3 pack blister"]],
  [/\b(?:2er|zweier|2 ?pack) ?blister\b/, ["2 pack blister"]],
];

// Einzelwörter. Muster passt auf das ganze Wort; Plural/Zusammensetzungen über Präfix (kollektion(en)).
const WORDS = [
  [/^kollektion(?:en)?$|^collections?$/, ["collection"]],
  [/^spezial$|^special$/, ["special"]],
  [/^dose(?:n)?$|^tins?$/, ["tin"]],
  [/^blister$|^blisters$/, ["blister"]],
  [/^booster$|^boosters$/, ["booster"]],
  [/^bundle$|^bundles$/, ["bundle"]],
  [/^figuren?$|^figures?$/, ["figure"]],
  [/^anstecker$|^pins?$/, ["pin"]],
  [/^plusch$|^plush$/, ["plush"]],
  [/^geschenk(?:e)?$|^gift$/, ["gift"]],
  [/^exklusiv$|^exclusive$/, ["exclusive", "pokemon center"]],
  [/^tasche$|^bag$/, ["bag"]],
  [/^mappe$|^folder$/, ["folder"]],
  [/^kartenhulle(?:n)?$|^sleeves?$/, ["sleeves"]],
  [/^decks$/, ["deck"]],
];

// Füllwörter, die in keinem Produktnamen helfen
const STOP = new Set(["pokemon", "tcg", "karten", "karte", "sealed", "versiegelt", "the", "and", "und", "der", "die", "das", "von", "of"]);

// Eine Suche -> Liste von Bedingungen; jede Bedingung = englische/deutsche Varianten, von denen eine vorkommen muss
export function parseSealedQuery(query) {
  let text = norm(query);
  const needs = [];
  for (const [re, alts] of PHRASES) {
    if (re.test(text)) {
      needs.push(alts);
      text = text.replace(re, " ");
    }
  }
  for (const word of text.split(/\s+/).filter(Boolean)) {
    if (STOP.has(word)) continue;
    const hit = WORDS.find(([re]) => re.test(word));
    const alts = hit ? [...hit[1]] : [word];
    // deutscher Pokémon-Name ("Glurak Kollektion") -> auch der englische (Liste der Kartensuche)
    if (!hit && word.length >= 3) for (const en of expandQuery(word)) alts.push(norm(en));
    // "tins" -> auch "tin"; sonst findet ein Plural nichts
    if (!hit && word.length > 3 && word.endsWith("s")) alts.push(word.slice(0, -1));
    needs.push(alts);
  }
  return needs;
}

const allStmt = db.prepare(`
  SELECT c.id, c.set_id, c.name, c.image, c.price_cents, s.name AS set_name, s.series, s.release_date
  FROM sealed_catalog c LEFT JOIN card_sets s ON s.id = c.set_id
`);

// ca. 2.000 Zeilen: im Speicher gehalten (normalisiert), Katalog und Preise ändern sich nur nachts
let cache = null;
let cacheAt = 0;
const CACHE_MS = 5 * 60 * 1000;
function rows() {
  if (cache && Date.now() - cacheAt < CACHE_MS) return cache;
  cache = allStmt.all().map((r) => ({
    ...r,
    nameNorm: ` ${norm(r.name)}`,
    hay: ` ${norm(`${r.name} ${r.set_name ?? ""} ${r.series ?? ""} ${r.set_id}`)}`,
  }));
  cacheAt = Date.now();
  return cache;
}

export function searchSealed(query, limit = 24) {
  const needs = parseSealedQuery(query);
  if (!needs.length) return { total: 0, items: [] };
  const hits = rows().filter((r) => needs.every((alts) => alts.some((a) => r.hay.includes(` ${a}`))));
  // Reihenfolge: Treffer direkt im Produktnamen, dann neuere Sets, dann teurere Produkte
  const inName = (r) => needs.every((alts) => alts.some((a) => r.nameNorm.includes(` ${a}`)));
  hits.sort(
    (a, b) =>
      Number(inName(b)) - Number(inName(a)) ||
      String(b.release_date ?? "").localeCompare(String(a.release_date ?? "")) ||
      (b.price_cents ?? -1) - (a.price_cents ?? -1)
  );
  return {
    total: hits.length,
    items: hits.slice(0, limit).map((r) => ({
      id: r.id,
      name: r.name,
      image: r.image,
      setId: r.set_id,
      setName: r.set_name,
      priceCents: r.price_cents,
    })),
  };
}
