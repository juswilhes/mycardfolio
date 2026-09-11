import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getMarketMovers } from "../api.js";

const eur = (n) => `${Math.abs(Number(n)).toFixed(2)} €`;

function Row({ m, positive }) {
  return (
    <Link
      to={`/database/${m.external_id}`}
      className="flex items-center gap-3 py-2.5 border-b border-line text-sm hover:bg-surface/60"
    >
      <img src={m.image_small} alt="" className="w-8 rounded shrink-0" />
      <span className="flex-1 min-w-0">
        <span className="font-medium truncate block">{m.name}</span>
        <span className="text-subtle text-xs truncate block">{m.set_name}</span>
      </span>
      <span className={`font-mono text-right shrink-0 ${positive ? "text-mint" : "text-rose"}`}>
        {positive ? "+" : "−"}
        {eur(m.delta)}
        <span className="block text-[11px] text-subtle">
          ({positive ? "+" : "−"}
          {Math.abs(m.delta_pct).toFixed(1)} %)
        </span>
      </span>
    </Link>
  );
}

// Größte Gewinner/Verlierer über alle Karten, die irgendwer sich je
// angesehen hat (nicht nur die eigene Sammlung) - wächst mit der Zeit, je
// mehr Karten auf mycardfolio angesehen werden. Bewusst schlicht gehalten:
// erste Version ohne Filter, die kommen später dazu.
export default function MarketMovers() {
  const [days, setDays] = useState(7);
  const [data, setData] = useState(null);

  useEffect(() => {
    setData(null);
    getMarketMovers(days).then(setData).catch(() => setData({ gainers: [], losers: [], trackedCount: 0 }));
  }, [days]);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-2">
          {[7, 30].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`text-xs px-3 py-1.5 rounded-full border ${
                days === d ? "border-ink text-ink" : "border-line text-subtle hover:border-ink"
              }`}
            >
              {d} Tage
            </button>
          ))}
        </div>
        {data && (
          <span className="text-xs text-subtle">{data.trackedCount} beobachtete Karten</span>
        )}
      </div>

      {data === null ? (
        <p className="text-subtle text-sm">Lade Marktdaten …</p>
      ) : data.gainers.length === 0 && data.losers.length === 0 ? (
        <p className="text-subtle text-sm py-8">
          Noch keine Preisbewegungen im Beobachtungszeitraum. Diese Liste wächst automatisch, je mehr
          Karten auf mycardfolio angesehen werden.
        </p>
      ) : (
        <div className="grid sm:grid-cols-2 gap-x-8">
          <section>
            <h2 className="text-sm text-subtle mb-2">Top-Gewinner ({days} Tage)</h2>
            {data.gainers.length ? (
              data.gainers.map((m) => <Row key={m.card_id} m={m} positive />)
            ) : (
              <p className="text-subtle text-sm py-2">–</p>
            )}
          </section>
          <section>
            <h2 className="text-sm text-subtle mb-2">Top-Verlierer ({days} Tage)</h2>
            {data.losers.length ? (
              data.losers.map((m) => <Row key={m.card_id} m={m} positive={false} />)
            ) : (
              <p className="text-subtle text-sm py-2">–</p>
            )}
          </section>
        </div>
      )}

      <p className="text-xs text-subtle mt-6">
        Basis: Cardmarket-Trendpreise der Karten, die auf mycardfolio schon einmal angesehen wurden
        (aktuell {data?.trackedCount ?? "…"}). Kein Marktüberblick über alle je erschienenen Karten.
      </p>
    </div>
  );
}
