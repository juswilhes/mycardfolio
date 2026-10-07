import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { getSetValueAnalysis } from "../api.js";

const eur = (n) => `${Number(n).toFixed(2)} €`;

const SORTS = {
  box_ratio: { label: "Top 20 im Verhältnis zum Boxpreis", fn: (a, b) => (b.boxRatio ?? -1) - (a.boxRatio ?? -1) },
  booster_ratio: { label: "Top 20 in Boostern", fn: (a, b) => (b.boosterRatio ?? -1) - (a.boosterRatio ?? -1) },
  top20: { label: "Wert der Top 20", fn: (a, b) => b.top20Value - a.top20Value },
  new: { label: "Neueste zuerst", fn: (a, b) => (b.release_date || "").localeCompare(a.release_date || "") },
};

// Analyse "Display & Booster": lohnt sich der Kauf eines Displays/Boosters im
// Verhältnis zu dem, was die 20 teuersten Karten des Sets wert sind? Preise
// für Box/Booster pflegt der Betreiber von Hand auf der Set-Seite (keine
// freie API-Quelle) - Sondersets ohne Display haben nur einen Boosterpreis.
export default function SetValueAnalysis() {
  const [rows, setRows] = useState(null);
  const [sort, setSort] = useState("new");

  useEffect(() => {
    getSetValueAnalysis().then(setRows).catch(() => setRows([]));
  }, []);

  const shown = useMemo(() => {
    if (!rows) return [];
    return rows
      .map((s) => {
        const box = s.boxPriceCents != null ? s.boxPriceCents / 100 : null;
        const booster = s.boosterPriceCents != null ? s.boosterPriceCents / 100 : null;
        return {
          ...s,
          box,
          booster,
          boxRatio: box && s.top20Count ? (s.top20Value / box) * 100 : null,
          boosterRatio: booster && s.top20Count ? s.top20Value / booster : null,
        };
      })
      .sort(SORTS[sort].fn);
  }, [rows, sort]);

  if (rows === null) return <p className="text-subtle text-sm">Lade Auswertung …</p>;

  if (rows.length === 0) {
    return (
      <p className="text-subtle text-sm">
        Noch keine Preise hinterlegt. Box- und Boosterpreis trägst du auf der jeweiligen Set-Seite ein.
      </p>
    );
  }

  return (
    <div className="mb-10">
      <h2 className="text-sm font-medium mb-1">📦 Display &amp; Booster im Vergleich</h2>
      <p className="text-xs text-subtle mb-3">
        Wie viel sind die 20 teuersten Karten eines Sets wert – im Verhältnis zum Preis eines Displays
        bzw. eines einzelnen Boosters? Kartenwerte sind der 30-Tage-Schnitt. Sondersets ohne Display
        (z. B. 30th Celebration) haben nur einen Boosterpreis.
      </p>

      <select
        value={sort}
        onChange={(e) => setSort(e.target.value)}
        className="border border-line rounded-full px-3 py-1.5 text-xs bg-canvas text-ink focus:outline-none focus:border-ink mb-3"
      >
        {Object.entries(SORTS).map(([v, { label }]) => (
          <option key={v} value={v}>Sortieren: {label}</option>
        ))}
      </select>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-subtle border-b border-line">
              <th className="py-2 pr-3 font-normal">Set</th>
              <th className="py-2 pr-3 font-normal text-right">Box</th>
              <th className="py-2 pr-3 font-normal text-right">Booster</th>
              <th className="py-2 pr-3 font-normal text-right">Top 20</th>
              <th className="py-2 pr-3 font-normal text-right">% der Box</th>
              <th className="py-2 pr-3 font-normal text-right">= Booster</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((s) => (
              <tr key={s.id} className="border-b border-line hover:bg-surface/60">
                <td className="py-2 pr-3">
                  <Link to={`/sets/${s.id}`} className="font-medium hover:underline">
                    {s.name}
                  </Link>
                  <span className="text-subtle text-xs"> · {s.release_date ? s.release_date.slice(0, 4) : "–"}</span>
                </td>
                <td className="py-2 pr-3 text-right font-mono">{s.box != null ? eur(s.box) : <span className="text-subtle">–</span>}</td>
                <td className="py-2 pr-3 text-right font-mono">{s.booster != null ? eur(s.booster) : <span className="text-subtle">–</span>}</td>
                <td className="py-2 pr-3 text-right font-mono">
                  {s.top20Count ? eur(s.top20Value) : <span className="text-subtle">–</span>}
                  {s.top20Count > 0 && s.top20Count < 20 && (
                    <span className="text-subtle text-xs" title="Erst für so viele Karten liegt ein Preis vor"> ({s.top20Count})</span>
                  )}
                </td>
                <td className="py-2 pr-3 text-right font-mono">
                  {s.boxRatio != null ? `${s.boxRatio.toFixed(0)} %` : <span className="text-subtle">–</span>}
                </td>
                <td className="py-2 pr-3 text-right font-mono">
                  {s.boosterRatio != null ? s.boosterRatio.toFixed(1) : <span className="text-subtle">–</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
