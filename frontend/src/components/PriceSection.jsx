import { useState } from "react";
import PriceChart from "./PriceChart.jsx";
import { eur } from "../lib/format.js";
import { RANGES, rangeDays, withinDays } from "../lib/chartRange.js";

const VARIANT_LABEL = { holo: "Holo", reverse: "Reverse Holo" };

// Aktueller Preis einer Variante = letzter Tageswert ihrer Reihe (der Graph
// zeigt dieselbe Reihe, deshalb stimmen beide immer überein). Für "normal"
// kommt er schon vom Server (card.latest_price) - hier für die Sonder-Variante.
function lastPrice(history, variant) {
  const pts = (history ?? []).filter((h) => (h.variant ?? "normal") === variant);
  return pts.length ? pts[pts.length - 1].price : null;
}

// Veränderung im gewählten Zeitraum (Justus: immer passend zur Auswahl 1 Monat, 3 Monate ...): erster gegen
// letzten Tageswert innerhalb des Zeitraums - reine Beobachtung, keine Vorhersage. Beginnt die Aufzeichnung
// später als der Zeitraum, steht das dabei.
function computeMomentum(history, days) {
  if (!history?.length) return null;
  const byDay = new Map();
  for (const h of withinDays(history, days, (x) => x.fetched_at)) {
    if (h.price == null) continue;
    if ((h.variant ?? "normal") !== "normal") continue; // Momentum nur für die Standard-Variante, nicht mit Holo vermischen
    byDay.set(h.fetched_at.slice(0, 10), h.price);
  }
  const rows = [...byDay.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  if (rows.length < 2) return { days: rows.length };
  const [firstDay, firstPrice] = rows[0];
  const [lastDay, lastPrice] = rows[rows.length - 1];
  if (!firstPrice) return { days: rows.length };
  return {
    days: rows.length,
    firstDay,
    lastDay,
    firstPrice,
    lastPrice,
    pct: ((lastPrice - firstPrice) / firstPrice) * 100,
  };
}

// Beschriftung der Veränderung je Zeitraum
const RANGE_TEXT = { "1m": "im letzten Monat", "3m": "in den letzten 3 Monaten", "6m": "in den letzten 6 Monaten", "12m": "in den letzten 12 Monaten" };

// Einheitliche Preis-Anzeige für Sammlungs- und Datenbank-Detailseite.
// Alles in EUR. Bevorzugte Quelle: Cardmarket (ein Wert pro Karte, nicht nach Sprache/Zustand getrennt).
// Preise werden nur einmal täglich um 1 Uhr aktualisiert (kein Abruf beim
// Öffnen der Seite).
export default function PriceSection({ card, history }) {
  const [range, setRange] = useState("12m");
  const days = rangeDays(range);
  const momentum = computeMomentum(history, days);
  // Beginnt die Aufzeichnung der Karte erst innerhalb des Zeitraums, steht das dabei (Lücken zählen nicht)
  const firstTracked = (history ?? []).find((h) => (h.variant ?? "normal") === "normal" && h.price != null)?.fetched_at?.slice(0, 10);
  const spanDays = momentum?.firstDay
    ? Math.round((Date.parse(momentum.lastDay) - Date.parse(momentum.firstDay)) / 86400000)
    : 0;
  const shorterThanRange = momentum?.firstDay === firstTracked && spanDays < days - 2;
  const breakdown = card.price_breakdown ?? [];
  const pick = (variant) =>
    Object.fromEntries(
      breakdown.filter((b) => (b.variant ?? "normal") === variant).map((b) => [b.price_type, b.price])
    );
  const byType = pick("normal");
  // Eine zweite Ausführung (Reverse Holo oder Holo) gibt es nur, wenn der Server
  // dafür eine eigene Reihe liefert (siehe cardService.js alignToPrintings) -
  // Karten mit nur einer Ausführung haben nur einen Preis.
  const specialVariant = (history ?? []).find((h) => (h.variant ?? "normal") !== "normal")?.variant ?? null;
  const specialPrice = specialVariant ? lastPrice(history, specialVariant) : null;
  const baseLabel = (history ?? []).find((h) => h.baseLabel)?.baseLabel ?? null;
  // card.latest_price = letzter Tageswert (cardService.js latestTrend). byType.trend nur als Notnagel,
  // falls der Server mal nichts liefert. Den 30-Tage-Schnitt zeigen wir nicht mehr (Justus 23.10.2026).
  const headline = card.latest_price?.price ?? byType.trend ?? null;
  const basis = card.latest_price?.source ?? (breakdown.length ? "cardmarket" : null);

  const updated = card.cardmarket_updated
    ? new Date(card.cardmarket_updated).toLocaleString("de-DE", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  const sourceLabel =
    basis === "tcgplayer"
      ? "Quelle: TCGplayer (aus USD umgerechnet – Cardmarket hat für diese Karte keinen Preis)"
      : `Quelle: Cardmarket${updated ? ` · Stand ${updated} Uhr` : ""}`;

  return (
    <section>
      <div className="flex items-baseline gap-4 flex-wrap">
        <div>
          <p className="text-subtle text-sm">
            Aktueller Preis{specialPrice != null ? ` · ${baseLabel ?? "Normal"}` : ""}
          </p>
          <p className="text-3xl font-semibold font-mono">
            {headline != null ? eur(headline) : "—"}
          </p>
        </div>
      </div>

      {momentum && (
        <p className="mt-2 text-sm">
          {momentum.pct != null ? (
            <>
              <span className={momentum.pct > 1 ? "text-mint" : momentum.pct < -1 ? "text-rose" : "text-subtle"}>
                {momentum.pct > 1 ? "▲" : momentum.pct < -1 ? "▼" : "►"}{" "}
                {momentum.pct >= 0 ? "+" : ""}
                {momentum.pct.toFixed(1)} %
              </span>{" "}
              <span className="text-subtle text-xs">
                {shorterThanRange
                  ? `seit Beginn der Aufzeichnung vor ${spanDays} Tagen`
                  : RANGE_TEXT[range] ?? RANGES.find((r) => r.id === range)?.label}{" "}
                ({eur(momentum.firstPrice)} → {eur(momentum.lastPrice)})
              </span>
            </>
          ) : (
            <span className="text-subtle text-xs">
              Veränderung: im gewählten Zeitraum noch nicht genug Daten ({momentum.days} Tag{momentum.days === 1 ? "" : "e"})
            </span>
          )}
        </p>
      )}

      {specialPrice != null && (
        <div className="flex items-baseline gap-4 flex-wrap mt-2 text-sm">
          <span className="text-subtle text-xs">{VARIANT_LABEL[specialVariant]}-Variante:</span>
          <span className="font-mono">{eur(specialPrice)}</span>
        </div>
      )}

      {headline == null && (
        <p className="text-subtle text-sm mt-2">
          Für diese Karte gibt es aktuell keinen Preis (kommt bei sehr alten
          oder brandneuen Karten vor). Du kannst beim Bearbeiten einen eigenen
          Kaufpreis hinterlegen.
        </p>
      )}

      <div className="mt-4">
        <p className="text-sm text-subtle mb-1">Preisentwicklung</p>
        <PriceChart data={history} range={range} onRangeChange={setRange} />
      </div>

      {card.cardmarket_url && (
        <a
          href={card.cardmarket_url}
          target="_blank"
          rel="noreferrer"
          className="inline-block mt-3 text-sm border border-line rounded-full px-4 py-1.5 hover:border-ink"
        >
          Auf Cardmarket ansehen
        </a>
      )}

      <p className="text-xs text-subtle mt-2">
        {sourceLabel}
      </p>

      <details className="mt-3 text-xs text-subtle">
        <summary className="cursor-pointer hover:text-ink">Wie kommt der Preis zustande?</summary>
        <div className="mt-2 space-y-1.5 leading-relaxed">
          <p>
            Der <b>Aktuelle Preis</b> ist der neueste Tageswert – der letzte
            Punkt im Graphen. Jeder Tageswert wird mit den beiden Vortagen geglättet (Median). Er ist ein Mittelwert aus mehreren Cardmarket-Kennzahlen
            (Trend und Durchschnitt der letzten 1, 7 und 30 Tage), damit einzelne
            Ausreißer nicht durchschlagen. Bei Karten ab 3 € wird er zusätzlich
            mit dem TCGplayer-Marktpreis (USA, in Euro umgerechnet) gemittelt, sofern
            dieser vorliegt und plausibel ist. (Den „Tiefstpreis" zeigen wir bewusst nicht
            an – der ist oft nur ein einzelnes Schnäppchen-Angebot.)
          </p>
          <p>
            Die Cardmarket-Werte sind Marktpreise für diese Karte: <b>ein Wert pro Karte,
            nicht nach Sprache (Deutsch/Englisch) und nicht nach Zustand
            aufgeteilt</b>. Eine getrennte Preisquelle für deutsche und englische
            Karten oder einen bestimmten Zustand (z. B. Near Mint) gibt es für
            uns bisher nicht.
          </p>
          <p>
            Bei wenigen Karten hat Cardmarket keinen Wert; dann wird der
            TCGplayer-Marktpreis (USA) zum Tageskurs in Euro umgerechnet und
            entsprechend gekennzeichnet.
          </p>
          <p>
            <b>Ausführungen:</b> Gibt es eine Karte in zwei Ausführungen (zum
            Beispiel normal und Reverse Holo), zeigen wir für beide einen
            eigenen Wert und eine zweite Linie im Graphen. Karten, die es nur
            in einer Ausführung gibt, haben nur einen Preis und eine Linie.
            Mehr als zwei Ausführungen liefert die kostenlose Quelle nicht
            getrennt.
          </p>
          <p>
            eBay-Verkaufspreise sind hier (noch) nicht dabei: dafür gibt es
            keinen kostenlosen Zugang.
          </p>
          <p>
            Die <b>Veränderung</b> vergleicht den ersten mit dem letzten Preis im
            gewählten Zeitraum (1, 3, 6 oder 12 Monate) – eine reine Beobachtung,
            keine Vorhersage. Reicht die Aufzeichnung nicht so weit zurück, steht
            dabei, seit wann sie läuft.
          </p>
        </div>
      </details>
    </section>
  );
}
