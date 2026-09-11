import db from "../db/index.js";
import { listCollection, latestTrend } from "./cardService.js";
import { listSales } from "./portfolioService.js";

// 16 Orden für den "Ordenkoffer" - bewusst niedlich/kindlich gehalten und an
// bereits vorhandenen Daten berechnet (keine neue Aktivitäts-Verfolgung nötig).
export const ACHIEVEMENTS = [
  { id: "erster_fang", icon: "🃏", title: "Erster Fang", desc: "Deine erste Karte zur Sammlung hinzugefügt" },
  { id: "kleiner_schatz", icon: "📦", title: "Kleiner Schatz", desc: "10 Karten in deiner Sammlung" },
  { id: "grosse_sammlung", icon: "🏰", title: "Große Sammlung", desc: "100 Karten in deiner Sammlung" },
  { id: "schatzkammer", icon: "💎", title: "Schatzkammer", desc: "500 Karten in deiner Sammlung" },
  { id: "entdecker", icon: "🗺️", title: "Entdecker", desc: "Karten aus 5 verschiedenen Sets" },
  { id: "weltenbummler", icon: "🌍", title: "Weltenbummler", desc: "Karten aus 10 verschiedenen Sets" },
  { id: "halber_weg", icon: "🧩", title: "Halber Weg", desc: "Ein Set zur Hälfte vervollständigt" },
  { id: "meistersammler", icon: "🏆", title: "Meistersammler", desc: "Ein Set komplett vervollständigt" },
  { id: "kunstkenner", icon: "🎨", title: "Kunstkenner", desc: "Karten von 5 verschiedenen Illustratoren" },
  { id: "wertvoller_fund", icon: "💰", title: "Wertvoller Fund", desc: "Eine Karte im Wert von 50 € oder mehr" },
  { id: "kostbarkeit", icon: "👑", title: "Kostbarkeit", desc: "Eine Karte im Wert von 200 € oder mehr" },
  { id: "erster_handel", icon: "🤝", title: "Erster Handel", desc: "Deine erste Karte verkauft" },
  { id: "cleveres_naeschen", icon: "📈", title: "Cleveres Näschen", desc: "Eine Karte mit Gewinn verkauft" },
  { id: "sprachtalent", icon: "🌐", title: "Sprachtalent", desc: "Karten in Deutsch und Englisch gesammelt" },
  { id: "erste_bewertung", icon: "🥇", title: "Erste Bewertung", desc: "Eine gegradete Karte (PSA, BGS, …) in der Sammlung" },
  { id: "treuer_trainer", icon: "⭐", title: "Treuer Trainer", desc: "Seit 30 Tagen bei mycardfolio dabei" },
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
// { current, target, met } zurück - unabhängig davon, ob er schon "freigeschaltet" ist.
function computeProgress(userId) {
  const items = listCollection.all(userId);
  const totalQuantity = items.reduce((s, i) => s + (i.quantity ?? 1), 0);
  const sets = new Set(items.map((i) => i.set_id).filter(Boolean));
  const artists = new Set(items.map((i) => i.artist).filter(Boolean));
  const languages = new Set(items.map((i) => i.language).filter(Boolean));
  const hasGraded = items.some((i) => i.grading_company);
  const maxCardValue = items.reduce((max, i) => {
    const price = latestTrend(i.card_id, i.variant || "normal")?.price ?? 0;
    return Math.max(max, price);
  }, 0);
  const setRows = setProgressWithTotal.all(userId);
  const bestSetPct = setRows.reduce((max, r) => Math.max(max, r.owned / r.total), 0);
  const hasCompleteSet = setRows.some((r) => r.owned >= r.total);

  const { sales } = listSales(userId);
  const hasProfitableSale = sales.some((s) => s.realized > 0);

  const createdAt = userCreatedAt.get(userId)?.created_at;
  const accountAgeDays = createdAt
    ? (Date.now() - new Date(createdAt + "Z").getTime()) / (1000 * 60 * 60 * 24)
    : 0;

  return {
    erster_fang: { current: totalQuantity, target: 1 },
    kleiner_schatz: { current: totalQuantity, target: 10 },
    grosse_sammlung: { current: totalQuantity, target: 100 },
    schatzkammer: { current: totalQuantity, target: 500 },
    entdecker: { current: sets.size, target: 5 },
    weltenbummler: { current: sets.size, target: 10 },
    halber_weg: { current: Math.round(bestSetPct * 100), target: 50 },
    meistersammler: { current: hasCompleteSet ? 1 : 0, target: 1 },
    kunstkenner: { current: artists.size, target: 5 },
    wertvoller_fund: { current: Math.round(maxCardValue), target: 50 },
    kostbarkeit: { current: Math.round(maxCardValue), target: 200 },
    erster_handel: { current: sales.length, target: 1 },
    cleveres_naeschen: { current: hasProfitableSale ? 1 : 0, target: 1 },
    sprachtalent: { current: languages.size, target: 2 },
    erste_bewertung: { current: hasGraded ? 1 : 0, target: 1 },
    treuer_trainer: { current: Math.floor(accountAgeDays), target: 30 },
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
