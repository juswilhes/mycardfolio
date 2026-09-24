import db from "../db/index.js";
import { listCollection, latestTrend } from "./cardService.js";
import { listSales } from "./portfolioService.js";

// 16 Orden für den "Ordenkoffer" - bewusst schwer: jeder Orden verlangt
// deutlich mehr als "ein bisschen sammeln" und deckt eine eigene Dimension ab
// (Breite, Tiefe, Wert, Handel, Qualität, Treue). Reihenfolge = grobe
// Ordenreise von "gut dabei" bis "Legende". Die IDs bleiben stabil: bereits
// verdiente Orden bleiben verdient, auch wenn die Bedingung später
// verschärft wird (Freischaltungen liegen in user_achievements).
export const ACHIEVEMENTS = [
  { id: "erster_fang", icon: "🃏", title: "Kieselorden", desc: "Baue eine Sammlung von 100 verschiedenen Karten auf" },
  { id: "pokedex_forscher", icon: "🔎", title: "Forscherorden", desc: "Sammle 300 verschiedene Pokémon-Arten" },
  { id: "weltenbummler", icon: "🌍", title: "Kompassorden", desc: "Karten aus 50 verschiedenen Sets" },
  { id: "kunstkenner", icon: "🎨", title: "Pinselorden", desc: "Karten von 100 verschiedenen Illustratoren" },
  { id: "halber_weg", icon: "🧩", title: "Mosaikorden", desc: "Ein Set mit mindestens 50 Karten zu 90 % vervollständigt" },
  { id: "sprachtalent", icon: "🌐", title: "Babelorden", desc: "Mindestens 75 Karten in Deutsch und 75 in Englisch" },
  { id: "wertvoller_fund", icon: "💰", title: "Goldorden", desc: "Eine Karte im Wert von 500 € oder mehr" },
  { id: "elementmeister", icon: "⚡", title: "Elementarorden", desc: "Mindestens 10 Karten in jedem der 11 Pokémon-Typen" },
  { id: "fanclub", icon: "💖", title: "Herzorden", desc: "25 Karten von ein und demselben Illustrator" },
  { id: "erster_handel", icon: "🤝", title: "Marktorden", desc: "10 Karten verkauft" },
  { id: "meistergrad", icon: "🥇", title: "Perfektionsorden", desc: "3 Karten mit einer 10er-Bewertung (PSA/BGS/CGC)" },
  { id: "volltreffer", icon: "🎯", title: "Zielorden", desc: "Eine Karte (Kaufpreis ab 5 €) auf mindestens das Fünffache im Wert gestiegen" },
  { id: "meistersammler", icon: "🏆", title: "Vollendungsorden", desc: "3 komplette Sets mit jeweils mindestens 50 Karten" },
  { id: "gewinnstratege", icon: "📈", title: "Strategenorden", desc: "Insgesamt 2.500 € Gewinn aus Verkäufen erzielt" },
  { id: "kostbarkeit", icon: "👑", title: "Kronenorden", desc: "Eine Karte im Wert von 2.500 € oder mehr" },
  { id: "treuer_trainer", icon: "⭐", title: "Treueorden", desc: "Seit 365 Tagen bei mycardfolio dabei" },
];

const setProgressWithTotal = db.prepare(`
  SELECT c.set_id, COUNT(DISTINCT c.id) AS owned, cs.total AS total
  FROM collection_items ci
  JOIN cards c ON c.id = ci.card_id
  JOIN card_sets cs ON cs.id = c.set_id
  WHERE ci.user_id = ? AND cs.total > 0
  GROUP BY c.set_id
`);

const userCreatedAt = db.prepare(`SELECT created_at FROM users WHERE id = ?`);

// Aktuellen Fortschritt für jeden Orden berechnen. Gibt für jede Definition
// { current, target } zurück - unabhängig davon, ob er schon "freigeschaltet" ist.
function computeProgress(userId) {
  const items = listCollection.all(userId);
  const totalQuantity = items.reduce((s, i) => s + (i.quantity ?? 1), 0);
  const sets = new Set(items.map((i) => i.set_id).filter(Boolean));
  const artists = new Set(items.map((i) => i.artist).filter(Boolean));

  const langCount = { de: 0, en: 0 };
  const artistQty = new Map();
  for (const i of items) {
    if (i.language === "de" || i.language === "en") langCount[i.language] += i.quantity ?? 1;
    if (i.artist) artistQty.set(i.artist, (artistQty.get(i.artist) ?? 0) + (i.quantity ?? 1));
  }
  const minLangCount = Math.min(langCount.de, langCount.en);
  const maxArtistCount = artistQty.size ? Math.max(...artistQty.values()) : 0;

  const perfectGradeCount = items
    .filter((i) => i.grading_company && String(i.grade ?? "").trim() === "10")
    .reduce((n, i) => n + (i.quantity ?? 1), 0);
  const distinctCards = new Set(items.map((i) => i.card_id)).size;

  // Pokémon-Typ- und Pokédex-Vielfalt: aus den Karten-Stammdaten (JSON-Arrays),
  // die in listCollection() nicht mitgeliefert werden - gezielt nachgeladen.
  const cardIds = [...new Set(items.map((i) => i.card_id))];
  const metaById = new Map();
  if (cardIds.length) {
    const placeholders = cardIds.map(() => "?").join(",");
    for (const row of db
      .prepare(`SELECT id, types, national_pokedex FROM cards WHERE id IN (${placeholders})`)
      .all(...cardIds)) {
      metaById.set(row.id, row);
    }
  }
  const dexSet = new Set();
  // Pro Typ: wie viele VERSCHIEDENE Karten (nicht Stückzahl) - für "10 Karten je Typ".
  const typeCards = new Map();
  const typeDone = new Set();
  let bestGainRatio = 0;
  for (const i of items) {
    const meta = metaById.get(i.card_id);
    if (meta?.types && !typeDone.has(i.card_id)) {
      typeDone.add(i.card_id);
      try {
        for (const t of new Set(JSON.parse(meta.types))) typeCards.set(t, (typeCards.get(t) ?? 0) + 1);
      } catch {
        /* ignore malformed JSON */
      }
    }
    if (meta?.national_pokedex) {
      try {
        JSON.parse(meta.national_pokedex).forEach((n) => dexSet.add(n));
      } catch {
        /* ignore malformed JSON */
      }
    }
    if (i.purchase_price >= 5) {
      const current = latestTrend(i.card_id, i.variant || "normal")?.price ?? 0;
      bestGainRatio = Math.max(bestGainRatio, current / i.purchase_price);
    }
  }

  const maxCardValue = items.reduce((max, i) => {
    const price = latestTrend(i.card_id, i.variant || "normal")?.price ?? 0;
    return Math.max(max, price);
  }, 0);
  const setRows = setProgressWithTotal.all(userId);
  // Nur Sets ab 50 Karten zählen - sonst wären Mini-Sets (8-25 Karten) ein Freifahrtschein.
  const bigSets = setRows.filter((r) => r.total >= 50);
  const bestSetPct = bigSets.reduce((max, r) => Math.max(max, r.owned / r.total), 0);
  const completeSets = bigSets.filter((r) => r.owned >= r.total).length;
  const typesWith10 = [...typeCards.values()].filter((n) => n >= 10).length;

  const { sales } = listSales(userId);
  const totalRealizedProfit = sales.reduce((s, x) => s + x.realized, 0);

  const createdAt = userCreatedAt.get(userId)?.created_at;
  const accountAgeDays = createdAt
    ? (Date.now() - new Date(createdAt + "Z").getTime()) / (1000 * 60 * 60 * 24)
    : 0;

  return {
    erster_fang: { current: distinctCards, target: 100 },
    pokedex_forscher: { current: dexSet.size, target: 300 },
    weltenbummler: { current: sets.size, target: 50 },
    kunstkenner: { current: artists.size, target: 100 },
    halber_weg: { current: Math.round(bestSetPct * 100), target: 90 },
    sprachtalent: { current: minLangCount, target: 75 },
    wertvoller_fund: { current: Math.round(maxCardValue), target: 500 },
    elementmeister: { current: typesWith10, target: 11 },
    fanclub: { current: maxArtistCount, target: 25 },
    erster_handel: { current: sales.length, target: 10 },
    meistergrad: { current: perfectGradeCount, target: 3 },
    volltreffer: { current: Math.round(bestGainRatio * 100), target: 500 },
    meistersammler: { current: completeSets, target: 3 },
    gewinnstratege: { current: Math.round(totalRealizedProfit), target: 2500 },
    kostbarkeit: { current: Math.round(maxCardValue), target: 2500 },
    treuer_trainer: { current: Math.floor(accountAgeDays), target: 365 },
  };
}

// Einmalige Neubewertung nach der Verschärfung aller 16 Orden (v2): Freischaltungen
// unter den alten, leichteren Regeln würden sonst mit Fortschritt unter dem neuen
// Ziel als "verdient" stehen bleiben. Danach schaltet getAchievements() alles
// Erreichte wieder frei (mit neuem Datum). Läuft genau einmal pro Datenbank.
if (!db.prepare(`SELECT 1 FROM app_meta WHERE key = 'orden_v2_reset'`).get()) {
  db.prepare(`DELETE FROM user_achievements`).run();
  db.prepare(`INSERT INTO app_meta (key, value) VALUES ('orden_v2_reset', datetime('now'))`).run();
}

const insertIfNew = db.prepare(`
  INSERT OR IGNORE INTO user_achievements (user_id, achievement_id, earned_at)
  VALUES (?, ?, datetime('now'))
`);
const earnedRows = db.prepare(`SELECT achievement_id, earned_at FROM user_achievements WHERE user_id = ?`);

// Orden + Fortschritt für einen Nutzer. Schaltet dabei still neu erreichte
// Orden frei (Zeitpunkt wird beim ersten Erkennen gespeichert).
export function getAchievements(userId) {
  const progress = computeProgress(userId);

  for (const def of ACHIEVEMENTS) {
    const p = progress[def.id];
    if (p && p.current >= p.target) insertIfNew.run(userId, def.id);
  }

  const earned = new Map(earnedRows.all(userId).map((r) => [r.achievement_id, r.earned_at]));

  return ACHIEVEMENTS.map((def) => ({
    ...def,
    ...progress[def.id],
    earned: earned.has(def.id),
    earned_at: earned.get(def.id) ?? null,
  }));
}
