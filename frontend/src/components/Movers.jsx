import { Link } from "react-router-dom";

const eur = (n) => `${Math.abs(Number(n)).toFixed(2)} €`;

function Row({ m, positive }) {
  return (
    <Link
      to={`/card/${m.card_id}`}
      className="flex items-center gap-2 py-1.5 text-sm hover:opacity-80"
    >
      <img src={m.image_small} alt="" className="w-6 rounded shrink-0" />
      <span className="flex-1 min-w-0 truncate">{m.name}</span>
      <span className={`font-mono shrink-0 ${positive ? "text-mint" : "text-rose"}`}>
        {positive ? "+" : "−"}
        {eur(m.delta)}
        <span className="text-subtle">
          {" "}({positive ? "+" : "−"}
          {Math.abs(m.delta_pct).toFixed(1)} %)
        </span>
      </span>
    </Link>
  );
}

// Top-Gewinner / -Verlierer der letzten 7 Tage (Trendpreis-Änderung).
export default function Movers({ data }) {
  if (!data) return null;
  const { gainers = [], losers = [] } = data;
  if (!gainers.length && !losers.length) return null;

  return (
    <div className="grid sm:grid-cols-2 gap-x-8 gap-y-2 mb-8">
      <div>
        <p className="text-xs text-subtle mb-1">Top-Gewinner (7 Tage)</p>
        {gainers.length ? (
          gainers.map((m) => <Row key={m.card_id} m={m} positive />)
        ) : (
          <p className="text-subtle text-sm py-1.5">–</p>
        )}
      </div>
      <div>
        <p className="text-xs text-subtle mb-1">Top-Verlierer (7 Tage)</p>
        {losers.length ? (
          losers.map((m) => <Row key={m.card_id} m={m} positive={false} />)
        ) : (
          <p className="text-subtle text-sm py-1.5">–</p>
        )}
      </div>
    </div>
  );
}
