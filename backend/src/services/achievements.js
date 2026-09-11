import db from "../db/index.js";
import { listCollection, latestTrend } from "./cardService.js";
import { listSales } from "./portfolioService.js";

// 16 Orden für den "Ordenkoffer" - jeder auf einer eigenen Sammel-Dimension
// (nicht nur "besitze mehr Karten"): Breite (Sets/Künstler/Arten/Typen),
// Tiefe (ein Set/ein Künstler), Wert, Handelsgeschick und Treue.
export const ACHIEVEMENTS = [
  { id: "erster_fang", icon: "🃏", title: "Erster Fang", desc: "Deine erste Karte zur Sammlung hinzugefügt" },
  { id: "erster_handel", icon: "🤝", title: "Erster Handel", desc: "Deine erste Karte verkauft" },
  { id: "weltenbummler", icon: "🌍", title: "Weltenbummler", desc: "Karten aus 30 verschiedenen Sets" },
  { id: "halber_weg", icon: "🧩", title: "Halber Weg", desc: "Ein Set zu 75 % vervollständigt" },
  { id: "meistersammler", icon: "🏆", title: "Meistersammler", desc: "Ein Set komplett vervollständigt" },
  { id: "kunstkenner", icon: "🎨", title: "Kunstkenner", desc: "Karten von 30 verschiedenen Illustratoren" },
  { id: "fanclub", icon: "💖", title: "Fanclub", desc: "50 Karten von ein und demselben Illustrator" },
  { id: "pokedex_forscher", icon: "🔎", title: "Pokédex-Forscher", desc: "100 verschiedene Pokémon-Arten gesammelt" },
  { id: "elementmeister", icon: "⚡", title: "Elementmeister", desc: "Karten aus allen 11 Pokémon-Typen der Sammelkartenwelt" },
  { id: "wertvoller_fund", icon: "💰", title: "Wertvoller Fund", desc: "Eine Karte im Wert von 150 € oder mehr" },
  { id: "kostbarkeit", icon: "👑", title: "Kostbarkeit", desc: "Eine Karte im Wert von 1.000 € oder mehr" },
  { id: "volltreffer", icon: "🎯", title: "Volltreffer", desc: "Eine Karte mindestens verdreifacht im Wert seit dem Kauf" },
  { id: "gewinnstratege", icon: "📈", title: "Gewinnstratege", desc: "Insgesamt 300 € Gewinn aus Verkäufen erzielt" },
  { id: "meistergrad", icon: "🥇", title: "Meistergrad", desc: "Eine Karte mit einer 10er-Bewertung (PSA/BGS/CGC)" },
  { id: "sprachtalent", icon: "🌐", title: "Sprachtalent", desc: "Mindestens 25 Karten in Deutsch und 25 in Englisch" },
  { id: "treuer_trainer", icon: "⭐", title: "Treuer Trainer", desc: "Seit 365 Tagen bei mycardfolio dabei" },
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

  const hasPerfectGrade = items.some(
    (i) => i.grading_company && String(i.grade ?? "").trim() === "10"
  );

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
  const typeSet = new Set();
  const dexSet = new Set();
  let bestGainRatio = 0;
  for (const i of items) {
    const meta = metaById.get(i.card_id);
    if (meta?.types) {
      try {
        JSON.parse(meta.types).forEach((t) => typeSet.add(t));
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
    if (i.purchase_price > 0) {
      const current = latestTrend(i.card_id, i.variant || "normal")?.price ?? 0;
      bestGainRatio = Math.max(bestGainRatio, current / i.purchase_price);
    }
  }

  const maxCardValue = items.reduce((max, i) => {
    const price = latestTrend(i.card_id, i.variant || "normal")?.price ?? 0;
    return Math.max(max, price);
  }, 0);
  const setRows = setProgressWithTotal.all(userId);
  const bestSetPct = setRows.reduce((max, r) => Math.max(max, r.owned / r.total), 0);
  const hasCompleteSet = setRows.some((r) => r.owned >= r.total);

  const { sales } = listSales(userId);
  const totalRealizedProfit = sales.reduce((s, x) => s + x.realized, 0);

  const createdAt = userCreatedAt.get(userId)?.created_at;
  const accountAgeDays = createdAt
    ? (Date.now() - new Date(createdAt + "Z").getTime()) / (1000 * 60 * 60 * 24)
    : 0;

  return {
    erster_fang: { current: totalQuantity, target: 1 },
    erster_handel: { current: sales.length, target: 1 },
    weltenbummler: { current: sets.size, target: 30 },
    halber_weg: { current: Math.round(bestSetPct * 100), target: 75 },
    meistersammler: { current: hasCompleteSet ? 1 : 0, target: 1 },
    kunstkenner: { current: artists.size, target: 30 },
    fanclub: { current: maxArtistCount, target: 50 },
    pokedex_forscher: { current: dexSet.size, target: 100 },
    elementmeister: { current: typeSet.size, target: 11 },
    wertvoller_fund: { current: Math.round(maxCardValue), target: 150 },
    kostbarkeit: { current: Math.round(maxCardValue), target: 1000 },
    volltreffer: { current: Math.round(bestGainRatio * 100), target: 300 },
    gewinnstratege: { current: Math.round(totalRealizedProfit), target: 300 },
    meistergrad: { current: hasPerfectGrade ? 1 : 0, target: 1 },
    sprachtalent: { current: minLangCount, target: 25 },
    treuer_trainer: { current: Math.floor(accountAgeDays), target: 365 },
  };
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
