import { dayGrid, setCardValues, chainTotals, thinHistory, setsStmt } from "./setTotalValue.js";
import { slugOfSet } from "./setSlugs.js";
import { slugOfCard } from "./cardSlugs.js";

// Analyse "Top-Karten" (Justus 18.11.2026: "Top 20, Top 10 und Top 5 Karten für jedes Set, mit Graphen und einem
// Graphen der monatlichen Steigung/des Falls in Prozent"). Je Set die heute wertvollsten N Karten (je Karte eine
// Ausführung, wie Set-Gesamtwert) und der Verlauf ihres Gesamtwerts - "diese N Karten zu den Preisen von damals",
// als Kettenindex wie in setTotalValue.js (eine Karte ohne Preis an einem Tag lässt die Summe nicht springen).
// Monatliche Veränderung: letzter Wert des Monats gegen letzten Wert des Vormonats; fehlt der Vormonat (Beginn der
// Aufzeichnung), gegen den ersten Wert im Monat (partial = Teilmonat).
export const TOP_SIZES = [5, 10, 20];

function monthlyChanges(totals, end, days) {
  const lastOfMonth = new Map(); // "2026-10" -> letzter Wert im Monat
  const firstOfMonth = new Map();
  for (let i = 0; i <= end; i++) {
    if (totals[i] == null) continue;
    const m = days[i].slice(0, 7);
    if (!firstOfMonth.has(m)) firstOfMonth.set(m, totals[i]);
    lastOfMonth.set(m, totals[i]);
  }
  const months = [...lastOfMonth.keys()];
  return months.map((m, k) => {
    const prev = k > 0 ? lastOfMonth.get(months[k - 1]) : null;
    const base = prev ?? firstOfMonth.get(m);
    const pct = base > 0 ? ((lastOfMonth.get(m) - base) / base) * 100 : null;
    return { month: m, pct: pct == null ? null : Math.round(pct * 10) / 10, partial: prev == null };
  });
}

export function buildSetTopValue() {
  const grid = dayGrid();
  if (!grid) return [];
  const { days } = grid;
  const L = days.length;
  const out = [];
  for (const s of setsStmt.all()) {
    const { values, priced, end } = setCardValues(s.id, grid);
    if (end < 0) continue;
    const ranked = values
      .map((v, k) => ({ v, card: priced[k], price: v[end] }))
      .filter((x) => !Number.isNaN(x.price) && x.price > 0)
      .sort((a, b) => b.price - a.price);
    if (ranked.length < 5) continue; // zu kleine Sets (Promo-Häppchen) ergeben keine sinnvolle Top-5
    const tops = {};
    for (const n of TOP_SIZES) {
      const picked = ranked.slice(0, n);
      const totals = chainTotals(
        picked.map((x) => x.v),
        end,
        L
      );
      tops[n] = {
        count: picked.length,
        value: Math.round(totals[end] * 100) / 100,
        history: thinHistory(totals, end, days),
        months: monthlyChanges(totals, end, days),
      };
    }
    out.push({
      id: s.id,
      slug: slugOfSet(s.id),
      name: s.name,
      series: s.series,
      release_date: s.release_date,
      asOf: days[end],
      priced: ranked.length,
      cards: ranked.slice(0, 20).map((x) => ({
        external_id: x.card.external_id,
        slug: slugOfCard(x.card.external_id),
        name: x.card.name,
        image_small: x.card.image_small,
        price: x.price,
      })),
      tops,
    });
  }
  return out.sort((a, b) => b.tops[20].value - a.tops[20].value);
}

// Übersicht ohne Tagesverlauf (für die Tabelle; der Verlauf kommt nur für die gewählten Sets, siehe Route).
// change[Tage] = Veränderung in % gegen den Wert vor so vielen Tagen (Verlauf kürzer: gegen den ersten Punkt).
const CHANGE_DAYS = [30, 90, 180, 365];
export function topValueSummary(rows) {
  return rows.map(({ tops, cards, ...s }) => ({
    ...s,
    topCard: cards[0] ?? null, // die Liste aller 20 kommt mit /top-cards/history
    firstDay: tops[20].history[0]?.day ?? null,
    tops: Object.fromEntries(
      Object.entries(tops).map(([n, t]) => [
        n,
        {
          count: t.count,
          value: t.value,
          months: t.months,
          change: Object.fromEntries(CHANGE_DAYS.map((d) => [d, changeOver(t.history, d)])),
        },
      ])
    ),
  }));
}

function changeOver(history, daysBack) {
  if (history.length < 2) return null;
  const last = history[history.length - 1];
  const from = new Date(Date.parse(last.day) - daysBack * 86400000).toISOString().slice(0, 10);
  const base = history.find((h) => h.day >= from) ?? history[0];
  if (base === last || !(base.value > 0)) return null;
  return Math.round(((last.value - base.value) / base.value) * 1000) / 10;
}
