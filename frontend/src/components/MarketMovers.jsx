import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getMarketMovers, getTrackedSets, getWatchlistMovers } from "../api.js";

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

function WatchRow({ m }) {
  const flat = m.singlePoint || Math.abs(m.delta) < 0.01;
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
      <span className="text-right shrink-0">
        <span className="font-mono block">{eur(m.current)}</span>
        {flat ? (
          <span className="text-[11px] text-subtle">
            {m.singlePoint ? "noch keine Historie" : "unverändert"}
          </span>
        ) : (
          <span className={`text-[11px] font-mono ${m.delta > 0 ? "text-mint" : "text-rose"}`}>
            {m.delta > 0 ? "+" : "−"}
            {Math.abs(m.delta_pct).toFixed(1)} %
          </span>
        )}
      </span>
    </Link>
  );
}

// Größte Gewinner/Verlierer über alle Karten, die irgendwer sich je
// angesehen hat (nicht nur die eigene Sammlung) - wächst mit der Zeit, je
// mehr Karten auf mycardfolio angesehen werden. Dazu, wenn vorhanden, der
// Preisstatus der eigenen Watchlist - die direkte Brücke zu "was beobachte
// ich als Nächstes".
export default function MarketMovers() {
  const [days, setDays] = useState(7);
  const [setName, setSetName] = useState("");
  const [sets, setSets] = useState([]);
  const [data, setData] = useState(null);
  const [watch, setWatch] = useState(null);

  useEffect(() => {
    getTrackedSets().then(setSets).catch(() => setSets([]));
  }, []);

  useEffect(() => {
    setData(null);
    getMarketMovers(days, setName || null)
      .then(setData)
      .catch(() => setData({ gainers: [], losers: [], trackedCount: 0 }));
  }, [days, setName]);

  useEffect(() => {
    getWatchlistMovers(days).then(setWatch).catch(() => setWatch([]));
  }, [days]);

  return (
    <div>
      {watch && watch.length > 0 && (
        <div className="bg-surface border border-line rounded-2xl px-5 py-4 shadow-sm mb-8">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium">❤️ Auf deiner Watchlist</p>
            <Link to="/watchlist" className="text-xs text-subtle hover:text-ink underline">
              Watchlist ansehen
            </Link>
          </div>
          <div>
            {watch.slice(0, 8).map((m) => (
              <WatchRow key={m.card_id} m={m} />
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
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
          {sets.length > 1 && (
            <select
              value={setName}
              onChange={(e) => setSetName(e.target.value)}
              className="border border-line rounded-full px-3 py-1.5 text-xs bg-canvas text-ink focus:outline-none focus:border-ink"
            >
              <option value="">Alle Sets</option>
              {sets.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          )}
        </div>
        {data && <span className="text-xs text-subtle">{data.trackedCount} beobachtete Karten</span>}
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
