import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getSets } from "../api.js";

// "Alle Karten"-Startseite: zeigt jedes Pokemon-Set als Kachel, gruppiert
// nach Serie (z.B. "Karmesin & Purpur", "Schwert & Schild") - genau das
// Prinzip von pokemonkarte.de/Collectr: erst Sets, dann pro Set die Karten.
export default function Sets() {
  const [sets, setSets] = useState(null);
  const [q, setQ] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    getSets().then(setSets).catch(() => setSets([]));
  }, []);

  // Sets nach Serie gruppieren, damit die Seite nicht eine einzige lange
  // Liste ist, sondern wie bei den Vorbildern in Abschnitte zerfällt.
  const bySeries = (sets ?? []).reduce((acc, set) => {
    const key = set.series || "Weitere";
    (acc[key] ??= []).push(set);
    return acc;
  }, {});

  function submitSearch(e) {
    e.preventDefault();
    if (q.trim()) navigate(`/add?q=${encodeURIComponent(q.trim())}`);
  }

  return (
    <div>
      <h1 className="text-xl font-semibold mb-4">Alle Karten</h1>

      <form onSubmit={submitSearch} className="flex gap-2 mb-8">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Karte direkt suchen – Name, deutscher Name oder mit Nummer (180/132)"
          className="flex-1 border border-line rounded-full px-4 py-2.5 text-sm placeholder:text-subtle focus:outline-none focus:border-ink"
        />
        <button
          type="submit"
          className="bg-yellow text-yellowInk font-medium px-5 py-2.5 rounded-full text-sm"
        >
          Suchen
        </button>
      </form>

      {sets === null && <p className="text-subtle text-sm">Lade Sets …</p>}

      {Object.entries(bySeries).map(([series, seriesSets]) => (
        <div key={series} className="mb-8">
          <h2 className="text-sm text-subtle mb-3">{series}</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {seriesSets.map((set) => (
              <Link
                key={set.id}
                to={`/sets/${set.id}`}
                className="border border-line rounded-2xl p-4 flex flex-col items-start gap-2 hover:border-ink shadow-sm"
              >
                {set.logo ? (
                  <img src={set.logo} alt={set.name} className="h-8 object-contain" />
                ) : (
                  <span className="font-medium text-sm">{set.name}</span>
                )}
                <div className="text-xs text-subtle">
                  {set.total} Karten
                  {set.release_date ? ` · ${set.release_date.slice(0, 4)}` : ""}
                </div>
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
