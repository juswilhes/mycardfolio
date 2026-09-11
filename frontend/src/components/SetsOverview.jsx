import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { getSetsOverview } from "../api.js";

const eur = (n) => `${Number(n).toFixed(2)} €`;

const SORTS = {
  value_desc: { label: "Wert (hoch → niedrig)", fn: (a, b) => b.sumValue - a.sumValue },
  value_asc: { label: "Wert (niedrig → hoch)", fn: (a, b) => a.sumValue - b.sumValue },
  new: { label: "Neueste zuerst", fn: (a, b) => (b.release_date || "").localeCompare(a.release_date || "") },
  old: { label: "Älteste zuerst", fn: (a, b) => (a.release_date || "").localeCompare(b.release_date || "") },
  name: { label: "Name (A → Z)", fn: (a, b) => a.name.localeCompare(b.name) },
};

// Allgemeine Preisübersicht über ALLE Sets - nicht nur die, deren Karten
// zufällig irgendwer angesehen hat. Basis sind die "Chase"-Karten je Set
// (siehe backend/seedSetPrices.js), daher zeigt "Ø-Wert" den Schnitt der
// wertvollen Karten eines Sets, nicht den Wert des ganzen Sets.
export default function SetsOverview() {
  const [sets, setSets] = useState(null);
  const [sort, setSort] = useState("value_desc");
  const [series, setSeries] = useState("");

  useEffect(() => {
    getSetsOverview().then(setSets).catch(() => setSets([]));
  }, []);

  const seriesList = useMemo(() => {
    if (!sets) return [];
    return [...new Set(sets.map((s) => s.series).filter(Boolean))];
  }, [sets]);

  const shown = useMemo(() => {
    if (!sets) return [];
    return sets
      .filter((s) => !series || s.series === series)
      .slice()
      .sort(SORTS[sort].fn);
  }, [sets, sort, series]);

  if (sets === null) return <p className="text-subtle text-sm">Lade Set-Übersicht …</p>;

  const trackedTotal = sets.filter((s) => s.trackedCount > 0).length;

  return (
    <div className="mb-10">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-sm font-medium">🗂️ Sets im Überblick</h2>
        <span className="text-xs text-subtle">{trackedTotal} / {sets.length} Sets mit Preisdaten</span>
      </div>
      <p className="text-xs text-subtle mb-3">
        Ø-Preis der wertvollen Karten je Set (Illustration Rare, Secret Rare & Co. - nicht Common/
        Uncommon/Rare Holo). Kein Gesamtwert des Sets, sondern ein Vergleichsmaßstab zwischen Sets.
      </p>

      <div className="flex flex-wrap gap-2 mb-3">
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          className="border border-line rounded-full px-3 py-1.5 text-xs bg-canvas text-ink focus:outline-none focus:border-ink"
        >
          {Object.entries(SORTS).map(([v, { label }]) => (
            <option key={v} value={v}>{label}</option>
          ))}
        </select>
        {seriesList.length > 1 && (
          <select
            value={series}
            onChange={(e) => setSeries(e.target.value)}
            className="border border-line rounded-full px-3 py-1.5 text-xs bg-canvas text-ink focus:outline-none focus:border-ink"
          >
            <option value="">Alle Serien</option>
            {seriesList.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-subtle border-b border-line">
              <th className="py-2 pr-3 font-normal">Set</th>
              <th className="py-2 pr-3 font-normal">Serie</th>
              <th className="py-2 pr-3 font-normal">Jahr</th>
              <th className="py-2 pr-3 font-normal text-right">Ø-Wert (Chase-Karten)</th>
              <th className="py-2 pr-3 font-normal">Teuerste Karte</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((s) => (
              <tr key={s.id} className="border-b border-line hover:bg-surface/60">
                <td className="py-2 pr-3">
                  <Link to={`/sets/${s.id}`} className="font-medium hover:underline">
                    {s.name}
                  </Link>
                </td>
                <td className="py-2 pr-3 text-subtle">{s.series || "–"}</td>
                <td className="py-2 pr-3 text-subtle">{s.release_date ? s.release_date.slice(0, 4) : "–"}</td>
                <td className="py-2 pr-3 text-right font-mono">
                  {s.trackedCount ? eur(s.avgValue) : <span className="text-subtle">–</span>}
                </td>
                <td className="py-2 pr-3">
                  {s.topCard ? (
                    <Link to={`/database/${s.topCard.external_id}`} className="flex items-center gap-2 hover:underline">
                      <img src={s.topCard.image_small} alt="" className="w-6 rounded shrink-0" />
                      <span className="truncate">{s.topCard.name}</span>
                      <span className="font-mono text-subtle shrink-0">{eur(s.topCard.price)}</span>
                    </Link>
                  ) : (
                    <span className="text-subtle">noch keine Daten</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
