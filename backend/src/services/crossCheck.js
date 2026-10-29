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
const MIN_PRICE = 3; // Justus 23.10.2026: schon ab 3 EUR (vorher 10)
// Weicht TCGplayer um mehr als diesen Faktor ab, vergleichen die Quellen vermutlich nicht
// dasselbe (andere Ausführung/Zustand, falsche Zuordnung); ein Mittelwert würde dann zu keiner
// passen (Espeon Star POP: 6720 vs. 1696 EUR) -> nur Cardmarket
const MAX_FACTOR = 2.5;
// Mit Schlüssel (20.000 Abrufe/Tag) reicht es für alle Karten ab MIN_PRICE (~9.000), ohne nur für die teuersten 800
const MAX_MINUTES = process.env.POKEMONTCG_API_KEY ? 80 : 45;
// Ohne Schlüssel (dev.pokemontcg.io nimmt keine Anmeldungen mehr an, Okt 2026) schafft eine Nacht nur 800 Karten.
// Deshalb reihum: zuerst nie geprüfte, dann die am längsten nicht geprüften Karten; dazwischen gilt der Wert der
// letzten echten Prüfung bis zu CARRY_DAYS Tage (Justus 23.10.2026). ~8.700 Karten ab 3 EUR = alle ~11 Nächte einmal.
const CARRY_DAYS = 14;
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
      WHERE x.card_id = s.card_id AND x.price_type IN ('xcheck', 'xcheck_off') AND x.variant = s.variant AND substr(x.fetched_at, 1, 10) = ?
    )
  ORDER BY s.price DESC
`);
// Letzte ECHTE Prüfung je Karte (übernommene Werte tragen die Quelle 'tcgplayer-vortag' und zählen nicht)
const lastRealCheckStmt = db.prepare(`
  SELECT card_id, MAX(fetched_at) AS at FROM price_snapshots
  WHERE source = 'tcgplayer' AND price_type IN ('xcheck', 'xcheck_off')
  GROUP BY card_id
`);
const updateStmt = db.prepare(`UPDATE price_snapshots SET price = ? WHERE id = ?`);
// mit dem Zeitstempel der Cardmarket-Zeile, damit beide immer am selben Tag stehen (auch über Mitternacht)
const insertCheckStmt = db.prepare(`
  INSERT INTO price_snapshots (card_id, source, price_type, currency, price, variant, fetched_at)
  VALUES (?, 'tcgplayer', 'xcheck', 'EUR', ?, ?, ?)
`);
// übernommener Wert der letzten Prüfung (eigene Quelle, damit die Reihenfolge der Prüfungen weiterrückt)
const insertCarryStmt = db.prepare(`
  INSERT INTO price_snapshots (card_id, source, price_type, currency, price, variant, fetched_at)
  VALUES (?, 'tcgplayer-vortag', ?, 'EUR', ?, ?, ?)
`);
// Quellen widersprechen sich (über MAX_FACTOR): TCGplayer-Wert als 'xcheck_off' merken - die Preisbewegungen
// lassen solche Karten weg (z. B. Mudkip Star ex7-107: Cardmarket 9.980 EUR, günstigstes Angebot 7.999 EUR).
const insertOffStmt = db.prepare(`
  INSERT INTO price_snapshots (card_id, source, price_type, currency, price, variant, fetched_at)
  VALUES (?, 'tcgplayer', 'xcheck_off', 'EUR', ?, ?, ?)
`);

// Wert der letzten echten Gegenprobe (höchstens CARRY_DAYS Tage alt) - für Karten, die heute nicht dran waren
const lastCheckStmt = db.prepare(`
  SELECT price_type, price FROM price_snapshots
  WHERE card_id = ? AND variant = ? AND price_type IN ('xcheck', 'xcheck_off') AND source = 'tcgplayer'
    AND fetched_at >= COALESCE((SELECT price_valid_from FROM cards WHERE id = card_id), '')
    AND substr(fetched_at, 1, 10) < ? AND fetched_at > datetime(?, '-${CARRY_DAYS} days')
  ORDER BY fetched_at DESC LIMIT 1
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
  // Ohne API-Schlüssel erlaubt pokemontcg.io nur ~1.000 Abrufe am Tag: nie geprüfte zuerst, dann die am längsten
  // nicht geprüften; bei Gleichstand die teureren (rows ist schon nach Preis sortiert, sort ist stabil)
  const lastReal = new Map(lastRealCheckStmt.all().map((r) => [r.card_id, r.at]));
  rows.sort((a, b) => (lastReal.get(a.card_id) ?? "").localeCompare(lastReal.get(b.card_id) ?? ""));
  const budget = Math.min(limit, process.env.POKEMONTCG_API_KEY ? 12000 : 800);
  const byCard = new Map();
  for (const r of rows) {
    if (!byCard.has(r.card_id) && byCard.size >= budget) continue;
    if (!byCard.has(r.card_id)) byCard.set(r.card_id, []);
    byCard.get(r.card_id).push(r);
  }

  const rate = await usdToEur();
  const queue = [...byCard.values()];
  const stats = { gemittelt: 0, unplausibel: 0, ohneTcgplayer: 0, fehler: 0, vomVortag: 0 };
  const checked = new Set(); // heute wirklich bei pokemontcg.io abgefragt
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
        checked.add(group[0].card_id);
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
          insertOffStmt.run(r.card_id, Math.round(tcgEur * 100) / 100, r.variant, r.fetched_at);
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

  // Nicht geschafft (Abruffehler, Zeit- oder Abruf-Grenze): mit dem Wert der letzten Gegenprobe mitteln, damit
  // eine Karte nicht im Wechsel gemittelt und ungemittelt ist (das ergäbe wieder Sprünge in der Preisreihe).
  for (const r of rows) {
    if (checked.has(r.card_id)) continue;
    const last = lastCheckStmt.get(r.card_id, r.variant, day, day);
    if (!last) continue;
    if (last.price_type === "xcheck_off") {
      insertCarryStmt.run(r.card_id, "xcheck_off", last.price, r.variant, r.fetched_at);
      continue;
    }
    const factor = last.price / r.price;
    if (factor > MAX_FACTOR || factor < 1 / MAX_FACTOR) continue;
    db.transaction(() => {
      insertCarryStmt.run(r.card_id, "xcheck", last.price, r.variant, r.fetched_at);
      updateStmt.run(Math.round(((r.price + last.price) / 2) * 100) / 100, r.id);
    })();
    stats.vomVortag++;
  }

  console.log(
    `[gegenprobe] ${stats.gemittelt} Preise mit TCGplayer gemittelt, ${stats.unplausibel} unplausibel (nur Cardmarket), ` +
      `${stats.ohneTcgplayer} ohne TCGplayer-Wert, ${stats.fehler} Abruffehler, ${queue.length} nicht mehr geschafft, ` +
      `${stats.vomVortag} mit dem Wert der letzten Prüfung (max. ${CARRY_DAYS} Tage) gemittelt.`
  );
  return stats;
}
