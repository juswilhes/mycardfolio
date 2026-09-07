import PriceChart from "./PriceChart.jsx";

const eur = (n) =>
  Number(n).toLocaleString("de-DE", { style: "currency", currency: "EUR" });

const LABELS = { trend: "Trend", low: "Tiefstpreis", avg30: "Ø 30 Tage" };

// Einheitliche Preis-Anzeige für Sammlungs- und Datenbank-Detailseite.
// Alles in EUR. Bevorzugte Quelle: Cardmarket (englische Karte).
export default function PriceSection({ card, history }) {
  const breakdown = card.price_breakdown ?? [];
  const byType = Object.fromEntries(breakdown.map((b) => [b.price_type, b.price]));
  const headline = card.latest_price?.price ?? byType.trend ?? null;
  const basis = card.latest_price?.source ?? (breakdown.length ? "cardmarket" : null);

  const updated = card.cardmarket_updated
    ? new Date(card.cardmarket_updated).toLocaleDateString("de-DE")
    : null;

  const sourceLabel =
    basis === "tcgplayer"
      ? "Quelle: TCGplayer (aus USD umgerechnet – Cardmarket hat für diese Karte keinen Preis)"
      : `Quelle: Cardmarket${updated ? ` · Stand ${updated}` : ""}`;

  return (
    <section>
      <div className="flex items-baseline gap-4 flex-wrap">
        <div>
          <p className="text-subtle text-sm">Aktueller Preis</p>
          <p className="text-3xl font-semibold font-mono">
            {headline != null ? eur(headline) : "—"}
          </p>
        </div>
        {["low", "avg30"].map((t) =>
          byType[t] != null ? (
            <div key={t} className="text-sm">
              <p className="text-subtle text-xs">{LABELS[t]}</p>
              <p className="font-mono">{eur(byType[t])}</p>
            </div>
          ) : null
        )}
      </div>

      {headline == null && (
        <p className="text-subtle text-sm mt-2">
          Für diese Karte gibt es aktuell keinen Preis (kommt bei sehr alten
          oder brandneuen Karten vor). Du kannst beim Bearbeiten einen eigenen
          Kaufpreis hinterlegen.
        </p>
      )}

      <div className="mt-4">
        <p className="text-sm text-subtle mb-1">Preisentwicklung (Trend)</p>
        <PriceChart data={history} />
      </div>

      <p className="text-xs text-subtle mt-3">
        {sourceLabel}
        {basis !== "tcgplayer" && card.cardmarket_url && (
          <>
            {" · "}
            <a
              href={card.cardmarket_url}
              target="_blank"
              rel="noreferrer"
              className="underline hover:text-ink"
            >
              auf Cardmarket ansehen
            </a>
          </>
        )}
      </p>

      <details className="mt-3 text-xs text-subtle">
        <summary className="cursor-pointer hover:text-ink">Wie kommt der Preis zustande?</summary>
        <div className="mt-2 space-y-1.5 leading-relaxed">
          <p>
            <b>Trend</b> ist Cardmarkets eigener Richtwert – grob „was die Karte
            aktuell wert ist", geglättet über die letzten Verkäufe.{" "}
            <b>Tiefstpreis</b> ist das günstigste offene Angebot, <b>Ø 30 Tage</b>{" "}
            der Durchschnitts­verkaufspreis des letzten Monats.
          </p>
          <p>
            Es ist der Preis der <b>englischen</b> Karte. Für die deutsche
            Druckvariante gibt es keine frei verfügbare Preisquelle – deutsche
            Karten sind meist etwas günstiger.
          </p>
          <p>
            Bei wenigen Karten hat Cardmarket keinen Wert; dann wird der
            TCGplayer-Marktpreis (USA) zum Tageskurs in Euro umgerechnet und
            entsprechend gekennzeichnet.
          </p>
          <p>
            eBay-Verkaufspreise sind hier (noch) nicht dabei: dafür gibt es
            keinen kostenlosen Zugang.
          </p>
        </div>
      </details>
    </section>
  );
}
