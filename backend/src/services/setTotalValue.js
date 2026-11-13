import db from "../db/index.js";
import { variantSeries } from "./cardService.js";
import { slugOfSet } from "./setSlugs.js";
import { slugOfCard } from "./cardSlugs.js";

// Analyse "Set-Gesamtwert" (Justus 13.11.2026: "Set-Gesamtwert, Preisverlauf und der Preis gegenüber den anderen
// Sets"): je Set die Summe der aktuellen Preise aller Karten - je Karte EINE Ausführung (die Hauptreihe, wie
// latestTrend(card, "normal"); Reverse Holos zählen nicht extra) - und der Verlauf dieser Summe.
// Preise je Tag aus derselben bereinigten Reihe wie Graph und Kartenseite (variantSeries: Ausreißer, Glättung,
// price_valid_from). Fehlt einer Karte ein Tageswert, gilt ihr letzter Wert bis CARRY_DAYS zurück.
// Verlauf als Kettenindex: von Tag zu Tag zählt nur die Veränderung der Karten, die an BEIDEN Tagen einen Preis
// haben. Sonst ließe jede neu importierte oder neu bepreiste Karte den Wert springen, obwohl sich am Markt nichts
// getan hat. Der letzte Punkt ist die echte heutige Summe; davor = "das Set, wie es heute ist, zu den Preisen von
// damals". Tragen die gemeinsamen Karten weniger als MIN_COMMON_SHARE des Werts, endet der Verlauf dort.
const CARRY_DAYS = 14;
const MIN_COMMON_SHARE = 0.5;
// Ältere Punkte nur wöchentlich, sonst wird die Antwort bei 180 Sets x 365 Tagen unnötig groß
const DAILY_DAYS = 92;
const DAY_MS = 24 * 60 * 60 * 1000;

const setsStmt = db.prepare(`SELECT id, name, series, release_date FROM card_sets`);
const cardsStmt = db.prepare(`SELECT id, external_id, name, image_small FROM cards WHERE set_id = ?`);
const firstDayStmt = db.prepare(`SELECT MIN(fetched_at) AS d FROM price_snapshots WHERE price_type = 'trend'`);

const dayOf = (iso) => iso.slice(0, 10);

export function buildSetTotalValue() {
  const first = firstDayStmt.get()?.d;
  if (!first) return [];
  const start = Date.parse(`${dayOf(first)}T00:00:00Z`);
  const today = Date.parse(`${dayOf(new Date().toISOString())}T00:00:00Z`);
  const days = [];
  for (let t = start; t <= today; t += DAY_MS) days.push(new Date(t).toISOString().slice(0, 10));
  const index = new Map(days.map((d, i) => [d, i]));
  const L = days.length;

  const out = [];
  for (const s of setsStmt.all()) {
    const cards = cardsStmt.all(s.id);
    if (!cards.length) continue;
    const values = []; // je Karte: Wert je Tag (NaN = kein Preis)
    const priced = [];
    let lastReal = -1; // letzter Tag mit echtem Wert (nicht übernommen) - danach wird nichts fortgeschrieben
    for (const c of cards) {
      const pts = variantSeries(c.id, "normal");
      if (!pts.length) continue;
      const v = new Float64Array(L).fill(NaN);
      for (const p of pts) {
        const i = index.get(dayOf(p.fetched_at));
        if (i == null) continue;
        v[i] = p.price; // mehrere Punkte am Tag: der letzte gilt
        if (i > lastReal) lastReal = i;
      }
      let last = NaN;
      let age = 0;
      for (let i = 0; i < L; i++) {
        if (!Number.isNaN(v[i])) {
          last = v[i];
          age = 0;
        } else if (!Number.isNaN(last) && ++age <= CARRY_DAYS) v[i] = last;
      }
      values.push(v);
      priced.push(c);
    }

    // Letzter Tag mit Preisen (vor dem Nachtlauf ist das gestern; fiel der Nachtlauf aus, der letzte echte Tag)
    let end = lastReal;
    const sumOn = (i) => values.reduce((a, v) => a + (Number.isNaN(v[i]) ? 0 : v[i]), 0);
    while (end >= 0 && sumOn(end) <= 0) end--;
    if (end < 0) continue;

    const totals = new Array(L).fill(null);
    totals[end] = sumOn(end);
    for (let i = end - 1; i >= 0; i--) {
      let a = 0;
      let b = 0;
      for (const v of values) {
        if (Number.isNaN(v[i]) || Number.isNaN(v[i + 1])) continue;
        a += v[i];
        b += v[i + 1];
      }
      if (a <= 0 || b <= 0 || b < sumOn(i + 1) * MIN_COMMON_SHARE) break;
      totals[i] = totals[i + 1] * (a / b);
    }

    const history = [];
    for (let i = 0; i <= end; i++) {
      if (totals[i] == null) continue;
      if (end - i > DAILY_DAYS && (end - i) % 7 !== 0) continue;
      history.push({ day: days[i], value: Math.round(totals[i] * 100) / 100 });
    }
    const value = totals[end];
    let top = null;
    let pricedNow = 0;
    values.forEach((v, k) => {
      if (Number.isNaN(v[end])) return;
      pricedNow++;
      if (!top || v[end] > top.price) top = { card: priced[k], price: v[end] };
    });
    out.push({
      id: s.id,
      slug: slugOfSet(s.id),
      name: s.name,
      series: s.series,
      release_date: s.release_date,
      value: Math.round(value * 100) / 100,
      cards: cards.length,
      priced: pricedNow,
      asOf: days[end],
      topCard: top
        ? {
            external_id: top.card.external_id,
            slug: slugOfCard(top.card.external_id),
            name: top.card.name,
            image_small: top.card.image_small,
            price: top.price,
            share: top.price / value,
          }
        : null,
      history,
    });
  }
  return out.sort((a, b) => b.value - a.value);
}
