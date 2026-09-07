import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getSets } from "../api.js";

// "Alle Karten"-Startseite: zeigt jedes Pokemon-Set als Kachel, gruppiert
// nach Serie (z.B. "Karmesin & Purpur", "Schwert & Schild") - genau das
// Prinzip von pokemonkarte.de/Collectr: erst Sets, dann pro Set die Karten.
export default function Sets() {
  const [sets, setSets] = useState(null);

  useEffect(() => {
    getSets().then(setSets).catch(() => setSets([]));
  }, []);

  if (sets === null) {
    return <p className="text-subtle text-sm">Lade Sets …</p>;
  }

  // Sets nach Serie gruppieren, damit die Seite nicht eine einzige lange
  // Liste ist, sondern wie bei den Vorbildern in Abschnitte zerfällt.
  const bySeries = sets.reduce((acc, set) => {
    const key = set.series || "Weitere";
    (acc[key] ??= []).push(set);
    return acc;
  }, {});

  return (
    <div>
      <h1 className="text-xl font-semibold mb-6">Alle Karten</h1>
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
