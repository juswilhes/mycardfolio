import db from "../db/index.js";
import { getRawPricesById } from "./pokemonTcgApi.js";
import { usdToEur } from "./priceProvider.js";

// Gegenprobe für teure Karten (Justus): bei dünnem Handel ist Cardmarkets Wert allein
// unzuverlässig (Drowzee SV #210: 37 -> 80 EUR in zwei Wochen). Ab MIN_PRICE gilt deshalb der
// Mittelwert aus dem Cardmarket-Preis (Median, siehe robustPrice) und dem TCGplayer-Marktpreis
// (USA, Dollar -> Euro) von pokemontcg.io. Der Mittelwert ersetzt den heutigen Cardmarket-
// "trend"-Wert (eine Preisreihe, siehe CLAUDE.md); der TCGplayer-Wert wird als 'xcheck'
// daneben abgelegt (zur Nachvollziehbarkeit und damit ein zweiter Lauf am selben Tag nicht
// doppelt mittelt). Läuft nur im Nachtlauf, nach der Preisliste.
const MIN_PRICE = 10;
// Weicht TCGplayer um mehr als diesen Faktor ab, vergleichen die Quellen vermutlich nicht
// dasselbe (andere Ausführung/Zustand, falsche Zuordnung); ein Mittelwert würde dann zu keiner
// passen (Espeon Star POP: 6720 vs. 1696 EUR) -> nur Cardmarket
const MAX_FACTOR = 2.5;
const MAX_MINUTES = 45;
const GAP_MS = 350; // kostenlose API ohne Schlüssel drosselt schnell
const WORKERS = 3;

const latestDayStmt = db.prepare(
  `SELECT substr(MAX(fetched_at), 1, 10) AS day FROM price_snapshots WHERE source = 'cardmarket' AND price_type = 'trend'`
);
const rowsStmt = db.prepare(`
  SELECT s.id, s.card_id, s.variant, s.price, s.fetched_at, c.external_id, c.variant_flags
  FROM price_snapshots s JOIN cards c ON c.id = s.card_id
  WHERE s.source = 'cardmarket' AND s.price_type = 'trend' AND substr(s.fetched_at, 1, 10) = ? AND s.price >= ?
    AND NOT EXISTS (
      SELECT 1 FROM price_snapshots x
      WHERE x.card_id = s.card_id AND x.price_type = 'xcheck' AND x.variant = s.variant AND substr(x.fetched_at, 1, 10) = ?
    )
  ORDER BY s.price DESC
`);
const updateStmt = db.prepare(`UPDATE price_snapshots SET price = ? WHERE id = ?`);
// mit dem Zeitstempel der Cardmarket-Zeile, damit beide immer am selben Tag stehen (auch über Mitternacht)
const insertCheckStmt = db.prepare(`
  INSERT INTO price_snapshots (card_id, source, price_type, currency, price, variant, fetched_at)
  VALUES (?, 'tcgplayer', 'xcheck', 'EUR', ?, ?, ?)
`);

const marketOf = (prices, keys) => {
  for (const k of keys) if (prices[k]?.market > 0) return prices[k].market;
  return null;
};

// Welcher TCGplayer-Preis passt zu unserer Zeile? Zwei Ausführungen: Spalte für Spalte;
// eine Ausführung: der eine vorhandene Preis (nie "1st Edition", die ist ein anderes Produkt).
function tcgplayerUsd(prices, flags, variant) {
  const count = [flags.normal, flags.holo, flags.reverse].filter(Boolean).length;
  if (count >= 2) {
    if (variant === "normal") return marketOf(prices, ["normal", "unlimitedNormal"]);
    return flags.reverse ? marketOf(prices, ["reverseHolofoil"]) : marketOf(prices, ["holofoil", "unlimitedHolofoil"]);
  }
  if (variant !== "normal") return null; // bei einer Ausführung zählt nur die Hauptzeile
  const order = flags.normal
    ? ["normal", "unlimitedNormal"]
    : flags.holo
      ? ["holofoil", "unlimitedHolofoil"]
      : ["reverseHolofoil"];
  return marketOf(prices, order);
}

export async function blendWithTcgplayer({ limit = Infinity } = {}) {
  const day = latestDayStmt.get()?.day;
  if (!day) return;
  const rows = rowsStmt.all(day, MIN_PRICE, day).filter((r) => r.variant_flags);
  // Ohne API-Schlüssel erlaubt pokemontcg.io nur ~1.000 Abrufe am Tag: die teuersten zuerst
  const budget = Math.min(limit, process.env.POKEMONTCG_API_KEY ? 4000 : 800);
  const byCard = new Map();
  for (const r of rows) {
    if (!byCard.has(r.card_id) && byCard.size >= budget) continue;
    if (!byCard.has(r.card_id)) byCard.set(r.card_id, []);
    byCard.get(r.card_id).push(r);
  }

  const rate = await usdToEur();
  const queue = [...byCard.values()];
  const stats = { gemittelt: 0, unplausibel: 0, ohneTcgplayer: 0, fehler: 0 };
  const deadline = Date.now() + MAX_MINUTES * 60_000;
  let nextStart = 0;
  let failStreak = 0;

  async function worker() {
    while (queue.length && Date.now() < deadline && failStreak < 15) {
      const group = queue.shift();
      const wait = Math.max(0, nextStart - Date.now());
      nextStart = Math.max(Date.now(), nextStart) + GAP_MS;
      if (wait) await new Promise((r) => setTimeout(r, wait));
      let raw;
      try {
        raw = await getRawPricesById(group[0].external_id);
        failStreak = 0;
      } catch {
        stats.fehler++;
        failStreak++;
        continue;
      }
      const prices = raw?.tcgplayer?.prices;
      const flags = JSON.parse(group[0].variant_flags);
      for (const r of group) {
        const usd = prices ? tcgplayerUsd(prices, flags, r.variant) : null;
        if (!usd) {
          stats.ohneTcgplayer++;
          continue;
        }
        const tcgEur = usd * rate;
        const factor = tcgEur / r.price;
        if (factor > MAX_FACTOR || factor < 1 / MAX_FACTOR) {
          stats.unplausibel++;
          continue;
        }
        db.transaction(() => {
          insertCheckStmt.run(r.card_id, Math.round(tcgEur * 100) / 100, r.variant, r.fetched_at);
          updateStmt.run(Math.round(((r.price + tcgEur) / 2) * 100) / 100, r.id);
        })();
        stats.gemittelt++;
      }
    }
  }
  await Promise.all(Array.from({ length: WORKERS }, worker));

  console.log(
    `[gegenprobe] ${stats.gemittelt} Preise mit TCGplayer gemittelt, ${stats.unplausibel} unplausibel (nur Cardmarket), ` +
      `${stats.ohneTcgplayer} ohne TCGplayer-Wert, ${stats.fehler} Abruffehler, ${queue.length} nicht mehr geschafft.`
  );
  return stats;
}
