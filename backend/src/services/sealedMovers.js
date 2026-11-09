import db from "../db/index.js";

// Preisbewegungen für Sealed-Produkte (Justus 09.11.2026), aus den Tageswerten in sealed_catalog_prices.
// Diese Tageswerte gibt es erst seit dem 09.11.2026 (Nachtlauf-Schritt "Sealed-Katalog"): solange der Verlauf kürzer
// ist als der gewünschte Zeitraum (7/30 Tage), gilt der Zeitraum seit dem ersten gespeicherten Tag (`spanDays` sagt,
// wie lang er wirklich ist) - die Bewegungen wachsen also von selbst mit.
const DAY_MS = 86400000;
const dayNum = (d) => Math.round(Date.parse(`${d}T00:00:00Z`) / DAY_MS);
const MAX_AGE_DAYS = 3; // Produkte ohne Tageswert der letzten Tage (nicht mehr im Katalog) bewegen nichts
const MIN_SPAN_DAYS = 2;
const MIN_PRICE = 3; // EUR; darunter sind Sprünge nur Rauschen
const MAX_ABS_PCT = 150; // größere Sprünge sind fast immer ein Zuordnungs-/Quellenwechsel, kein Markttrend

// series = [{ day, price_cents }] aufsteigend. -> { current, previous, delta, delta_pct, span } oder null
function moveOf(series, days) {
  if (series.length < 2) return null;
  const last = series[series.length - 1];
  const cutoff = dayNum(last.day) - days;
  let base = series[0];
  for (const p of series) {
    if (dayNum(p.day) <= cutoff) base = p;
    else break;
  }
  // mindestens 2 Tage Abstand: ein einzelner Tagessprung ist fast immer Rauschen
  if (dayNum(last.day) - dayNum(base.day) < MIN_SPAN_DAYS || !base.price_cents || last.price_cents == null) return null;
  const current = last.price_cents / 100;
  const previous = base.price_cents / 100;
  return {
    current,
    previous,
    delta: current - previous,
    delta_pct: ((current - previous) / previous) * 100,
    span: dayNum(last.day) - dayNum(base.day),
  };
}

const rowsStmt = db.prepare(`
  SELECT p.catalog_id, p.day, p.price_cents, c.name, c.image, s.name AS set_name
  FROM sealed_catalog_prices p
  JOIN sealed_catalog c ON c.id = p.catalog_id
  LEFT JOIN card_sets s ON s.id = c.set_id
  WHERE p.day >= date('now', '-40 day')
  ORDER BY p.catalog_id, p.day
`);

// Markt: größte Gewinner/Verlierer über alle Sealed-Produkte, für 7 und 30 Tage (Nachtlauf, analysisCache.js)
export function buildSealedMarketMovers() {
  const byProduct = new Map();
  for (const r of rowsStmt.all()) {
    let e = byProduct.get(r.catalog_id);
    if (!e) byProduct.set(r.catalog_id, (e = { id: r.catalog_id, name: r.name, image: r.image, set_name: r.set_name, series: [] }));
    e.series.push({ day: r.day, price_cents: r.price_cents });
  }
  const today = dayNum(new Date().toISOString().slice(0, 10));
  const out = {};
  for (const days of [7, 30]) {
    const movers = [];
    let spanDays = 0;
    for (const e of byProduct.values()) {
      if (today - dayNum(e.series[e.series.length - 1].day) > MAX_AGE_DAYS) continue;
      const m = moveOf(e.series, days);
      if (!m) continue;
      spanDays = Math.max(spanDays, m.span);
      if (m.current < MIN_PRICE || m.previous < MIN_PRICE || Math.abs(m.delta) < 0.01 || Math.abs(m.delta_pct) > MAX_ABS_PCT) continue;
      movers.push({ catalog_id: e.id, name: e.name, image: e.image, set_name: e.set_name, ...m });
    }
    out[days] = {
      gainers: movers.filter((m) => m.delta > 0).sort((a, b) => b.delta_pct - a.delta_pct).slice(0, 25),
      losers: movers.filter((m) => m.delta < 0).sort((a, b) => a.delta_pct - b.delta_pct).slice(0, 25),
      trackedCount: movers.length,
      spanDays,
    };
  }
  return out;
}

// Eigene Sammlung: Bewegung der Sealed-Produkte des Nutzers (7 Tage). Produkte mit eigenem Wert bewegen sich nicht
// (der Nutzer hat den Wert festgelegt), nur die mit automatischem Katalogwert zählen.
const ownStmt = db.prepare(`
  SELECT DISTINCT sp.catalog_id, sc.name, sc.image, s.name AS set_name
  FROM sealed_products sp
  JOIN sealed_catalog sc ON sc.id = sp.catalog_id
  LEFT JOIN card_sets s ON s.id = sc.set_id
  WHERE sp.user_id = ? AND sp.current_value IS NULL
`);
const seriesStmt = db.prepare(`SELECT day, price_cents FROM sealed_catalog_prices WHERE catalog_id = ? AND day >= date('now', '-40 day') ORDER BY day`);

export function getOwnSealedMovers(userId, days = 7) {
  const movers = [];
  let spanDays = 0;
  for (const p of ownStmt.all(userId)) {
    const m = moveOf(seriesStmt.all(p.catalog_id), days);
    if (!m) continue;
    spanDays = Math.max(spanDays, m.span);
    if (Math.abs(m.delta) < 0.01) continue;
    movers.push({ catalog_id: p.catalog_id, name: p.name, image: p.image, set_name: p.set_name, ...m });
  }
  movers.sort((a, b) => b.delta - a.delta);
  return {
    gainers: movers.filter((m) => m.delta > 0).slice(0, 3),
    losers: movers.filter((m) => m.delta < 0).slice(-3).reverse(),
    spanDays,
  };
}
