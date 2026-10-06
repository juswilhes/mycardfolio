import PriceChart from "./PriceChart.jsx";

const eur = (n) =>
  Number(n).toLocaleString("de-DE", { style: "currency", currency: "EUR" });

const VARIANT_LABEL = { holo: "Holo", reverse: "Reverse Holo" };

// Durchschnitt der letzten 30 Tage aus der eigenen, gesammelten Historie
// (nicht Cardmarkets eigener Trend- oder avg30-Wert) - für die Sonder-
// Variante (Holo/Reverse Holo), die der Server nicht separat mitgibt. Für
// "normal" kommt dieselbe Rechnung schon vom Server (card.latest_price),
// hier nur für die zweite Zeile unter der Headline gebraucht.
function avg30FromHistory(history, variant) {
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const prices = (history ?? [])
    .filter(
      (h) =>
        (h.variant ?? "normal") === variant &&
        h.price != null &&
        new Date(h.fetched_at).getTime() >= cutoff
    )
    .map((h) => h.price);
  if (!prices.length) return null;
  return prices.reduce((s, p) => s + p, 0) / prices.length;
}

// Momentum-Signal: reine Beobachtung ("Preis hat sich seit dem ersten
// getrackten Tag so verändert"), keine Vorhersage. Bewusst simpel und
// transparent - zeigt immer auch dazu, auf wie viel Historie das beruht,
// weil bei frisch getrackten Karten (die meisten - Preis-Tracking läuft
// erst seit kurzem) 2-3 Tage Datenbasis keine verlässliche Aussage sind.
function computeMomentum(history) {
  if (!history?.length) return null;
  const byDay = new Map();
  for (const h of history) {
    if (h.price == null) continue;
    if ((h.variant ?? "normal") !== "normal") continue; // Momentum nur für die Standard-Variante, nicht mit Holo vermischen
    byDay.set(h.fetched_at.slice(0, 10), h.price);
  }
  const days = [...byDay.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  if (days.length < 2) return { days: days.length };
  const [firstDay, firstPrice] = days[0];
  const [lastDay, lastPrice] = days[days.length - 1];
  if (!firstPrice) return { days: days.length };
  return {
    days: days.length,
    firstDay,
    lastDay,
    firstPrice,
    lastPrice,
    pct: ((lastPrice - firstPrice) / firstPrice) * 100,
  };
}

// Einheitliche Preis-Anzeige für Sammlungs- und Datenbank-Detailseite.
// Alles in EUR. Bevorzugte Quelle: Cardmarket (englische Karte).
// onRefresh (optional): Callback für den "Jetzt aktualisieren"-Button -
// stößt eine frische Abfrage bei TCGdex an, statt auf den nächsten
// automatischen Lauf (alle 4 Stunden) zu warten.
export default function PriceSection({ card, history, onRefresh, refreshing }) {
  const momentum = computeMomentum(history);
  const breakdown = card.price_breakdown ?? [];
  const pick = (variant) =>
    Object.fromEntries(
      breakdown.filter((b) => (b.variant ?? "normal") === variant).map((b) => [b.price_type, b.price])
    );
  const byType = pick("normal");
  // Pro Karte liefert die Quelle nie Holo UND Reverse Holo gleichzeitig,
  // sondern höchstens eine der beiden (siehe priceProvider.js) - also die
  // vorhandene Sonder-Variante im Breakdown suchen statt fix "holo".
  const specialVariant = breakdown.find((b) => b.variant === "reverse") ? "reverse" : "holo";
  const specialAvg = avg30FromHistory(history, specialVariant);
  // card.latest_price ist der selbst berechnete 30-Tage-Schnitt (siehe
  // cardService.js latestTrend()), nicht Cardmarkets einzelner Trend-Wert -
  // byType.trend nur als letzter Notnagel, falls der Server mal nichts liefert.
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
          <p className="text-subtle text-sm">Aktueller Preis</p>
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
                {momentum.pct > 1 ? "📈" : momentum.pct < -1 ? "📉" : "➡️"}{" "}
                {momentum.pct >= 0 ? "+" : ""}
                {momentum.pct.toFixed(1)} %
              </span>{" "}
              <span className="text-subtle text-xs">
                seit {momentum.days} Tagen ({eur(momentum.firstPrice)} → {eur(momentum.lastPrice)})
              </span>
            </>
          ) : (
            <span className="text-subtle text-xs">
              Momentum: noch nicht genug Daten (erst {momentum.days} Tag{momentum.days === 1 ? "" : "e"} getrackt)
            </span>
          )}
        </p>
      )}

      {specialAvg != null && (
        <div className="flex items-baseline gap-4 flex-wrap mt-2 text-sm">
          <span className="text-subtle text-xs">{VARIANT_LABEL[specialVariant]}-Variante:</span>
          <span className="font-mono">{eur(specialAvg)}</span>
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
        <PriceChart data={history} />
      </div>

      {card.cardmarket_url && (
        <a
          href={card.cardmarket_url}
          target="_blank"
          rel="noreferrer"
          className="inline-block mt-3 text-sm border border-line rounded-full px-4 py-1.5 hover:border-ink"
        >
          🔗 Auf Cardmarket ansehen
        </a>
      )}

      <p className="text-xs text-subtle mt-2">
        {sourceLabel}
        {onRefresh && (
          <>
            {" · "}
            <button
              onClick={onRefresh}
              disabled={refreshing}
              className="underline hover:text-ink disabled:opacity-50 disabled:no-underline"
            >
              {refreshing ? "aktualisiere …" : "🔄 Preis jetzt aktualisieren"}
            </button>
          </>
        )}
      </p>

      <details className="mt-3 text-xs text-subtle">
        <summary className="cursor-pointer hover:text-ink">Wie kommt der Preis zustande?</summary>
        <div className="mt-2 space-y-1.5 leading-relaxed">
          <p>
            Der <b>Aktuelle Preis</b> ist NICHT Cardmarkts einzelner
            Tageswert ("Trend"), sondern unser eigener Durchschnitt aus allen
            Tagespreisen, die wir in den letzten 30 Tagen selbst gesammelt
            haben. Das macht den Preis robuster: ein einzelner schlecht
            getroffener Tag (z.B. eine kurzzeitig falsch zugeordnete Karte)
            verzerrt dann nicht mehr den angezeigten Wert. Der Graph darunter
            zeigt trotzdem die einzelnen Tagespreise, damit du den Verlauf
            siehst. (Den „Tiefstpreis" zeigen wir bewusst nicht an – der ist
            oft nur ein einzelnes Schnäppchen-Angebot.)
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
            <b>Varianten:</b> Wenn eine Karte als Holo ODER als Reverse Holo
            existiert, zeigen wir dafür einen eigenen Wert (zweite Linie im
            Graphen). Beides gleichzeitig liefert die kostenlose Quelle nicht
            getrennt – dann greift für die zweite Variante der Standard-Wert.
          </p>
          <p>
            eBay-Verkaufspreise sind hier (noch) nicht dabei: dafür gibt es
            keinen kostenlosen Zugang.
          </p>
          <p>
            <b>Momentum</b> vergleicht nur den ersten mit dem letzten
            getrackten Preis – eine reine Beobachtung, keine Vorhersage. Die
            Preis-Historie läuft noch nicht lange, deshalb steht immer dabei,
            auf wie viele Tage sich das stützt.
          </p>
        </div>
      </details>
    </section>
  );
}
