import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getSets, getSetProgress } from "../api.js";

// "Alle Karten"-Startseite: jedes Pokemon-Set als Kachel, gruppiert nach
// Serie. Bei Sets, aus denen du Karten hast, ein Fortschrittsbalken.
export default function Sets() {
  const [sets, setSets] = useState(null);
  const [progress, setProgress] = useState({});

  useEffect(() => {
    getSets().then(setSets).catch(() => setSets([]));
    getSetProgress().then(setProgress).catch(() => setProgress({}));
  }, []);

  if (sets === null) {
    return <p className="text-subtle text-sm">Lade Sets …</p>;
  }

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
            {seriesSets.map((set) => {
              const owned = progress[set.id] ?? 0;
              const total = set.total || 0;
              const pct = total ? Math.min(100, (owned / total) * 100) : 0;
              return (
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
                  {owned > 0 && (
                    <div className="w-full mt-0.5">
                      <div className="h-1.5 rounded-full bg-line overflow-hidden">
                        <div className="h-full bg-yellow" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-[11px] text-subtle">
                        {owned} / {total} in deiner Sammlung
                      </span>
                    </div>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
