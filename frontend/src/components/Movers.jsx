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

// Top-3-Gewinner / -Verlierer als eigenständige Karte, passend zum übrigen
// Dashboard-Look (Sets im Blick / Ordenkoffer). Zeigt auch einen klaren
// Leer-Zustand statt einfach zu verschwinden, wenn (noch) nichts in
// Bewegung ist.
export default function Movers({ data, title = "📈 Top-Bewegungen (7 Tage)" }) {
  const gainers = data?.gainers ?? [];
  const losers = data?.losers ?? [];

  return (
    <div className="bg-surface border border-line rounded-2xl px-5 py-4 shadow-sm mb-8">
      <p className="text-sm font-medium mb-3">{title}</p>
      {!data ? (
        <p className="text-subtle text-sm">Lade …</p>
      ) : !gainers.length && !losers.length ? (
        <p className="text-subtle text-sm">Noch keine Preisbewegungen in diesem Zeitraum.</p>
      ) : (
        <div className="grid sm:grid-cols-2 gap-x-8 gap-y-2">
          <div>
            <p className="text-xs text-subtle mb-1">Top 3 Gewinner</p>
            {gainers.length ? (
              gainers.slice(0, 3).map((m) => <Row key={m.card_id} m={m} positive />)
            ) : (
              <p className="text-subtle text-sm py-1.5">–</p>
            )}
          </div>
          <div>
            <p className="text-xs text-subtle mb-1">Top 3 Verlierer</p>
            {losers.length ? (
              losers.slice(0, 3).map((m) => <Row key={m.card_id} m={m} positive={false} />)
            ) : (
              <p className="text-subtle text-sm py-1.5">–</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
