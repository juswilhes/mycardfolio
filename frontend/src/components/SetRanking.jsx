import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { getSetRanking } from "../api.js";
import { eur } from "../lib/format.js";

const dash = <span className="text-subtle">–</span>;
const num = (v, digits = 1) => v.toLocaleString("de-DE", { minimumFractionDigits: digits, maximumFractionDigits: digits });

// Spalten der Rangliste. `best`: höher ist besser (grün markiert den Besten
// je Spalte); beim Boosterpreis gibt es kein besser/schlechter.
const COLUMNS = [
  {
    id: "hitRatePct",
    label: "Hit Rate",
    best: true,
    title: "Chance auf mindestens eine besondere Karte pro Pack",
    show: (s) => `${s.hitRateComplete ? "" : "≥ "}${num(s.hitRatePct)} %`,
  },
  {
    id: "packValue",
    label: "Wert pro Pack",
    best: true,
    title: "Erwarteter Wert eines Boosters aus Pull Rates und Kartenpreisen",
    show: (s) => `${s.packComplete ? "" : "≥ "}${eur(s.packValue)}`,
  },
  { id: "booster", label: "Booster", best: false, title: "Boosterpreis", show: (s) => eur(s.booster) },
  {
    id: "valueRatio",
    label: "% vom Booster",
    best: true,
    title: "Wert pro Pack im Verhältnis zum Boosterpreis",
    show: (s) => `${num(s.valueRatio, 0)} %`,
  },
  {
    id: "top20Ratio",
    label: "Top 20 = Booster",
    best: true,
    title: "Wert der 20 teuersten Karten, gemessen in Boosterpreisen",
    show: (s) => num(s.top20Ratio, 0),
  },
];

// Analyse "Set-Rangliste": Hit Rate, Wert pro Pack und Top-20-Wert aller Sets
// nebeneinander, nach jeder Spalte sortierbar. Die Daten kommen fertig
// berechnet vom Server (analysisCache.js, Nachtlauf).
export default function SetRanking() {
  const [rows, setRows] = useState(null);
  const [sort, setSort] = useState({ id: "valueRatio", dir: -1 });

  useEffect(() => {
    getSetRanking().then(setRows).catch(() => setRows([]));
  }, []);

  const shown = useMemo(() => {
    if (!rows) return [];
    const data = rows.map((s) => {
      const booster = s.boosterPriceCents != null ? s.boosterPriceCents / 100 : null;
      return {
        ...s,
        booster,
        valueRatio: booster && s.packValue != null ? (s.packValue / booster) * 100 : null,
        top20Ratio: booster && s.top20Count ? s.top20Value / booster : null,
      };
    });
    // Beste je Spalte (für die grüne Markierung)
    const best = {};
    for (const c of COLUMNS) {
      if (!c.best) continue;
      const vals = data.map((s) => s[c.id]).filter((v) => v != null);
      best[c.id] = vals.length > 1 ? Math.max(...vals) : null;
    }
    const sorted = [...data].sort((a, b) => {
      const av = a[sort.id];
      const bv = b[sort.id];
      if (av == null && bv == null) return 0;
      if (av == null) return 1; // fehlende Werte immer ans Ende
      if (bv == null) return -1;
      return (av - bv) * sort.dir;
    });
    return sorted.map((s) => ({ ...s, best }));
  }, [rows, sort]);

  if (rows === null) return <p className="text-subtle text-sm">Lade Auswertung …</p>;

  const toggle = (id) => setSort((cur) => (cur.id === id ? { id, dir: -cur.dir } : { id, dir: -1 }));

  return (
    <div className="mb-10">
      <h2 className="text-sm font-medium mb-1">🏆 Set-Rangliste</h2>
      <p className="text-xs text-subtle mb-3">
        Alle Sets mit hinterlegten Pull Rates im direkten Vergleich. Ein Klick auf eine Spaltenüberschrift sortiert
        danach, ein zweiter Klick dreht die Reihenfolge um. Grün ist jeweils der beste Wert der Spalte. „% vom
        Booster" zeigt, wie viel vom Boosterpreis im Schnitt als Kartenwert zurückkommt; „Top 20 = Booster", wie
        viele Booster man für den Wert der 20 teuersten Karten kaufen könnte. „≥" heißt: nicht alle Seltenheiten
        sind erfasst, der echte Wert ist höher. Die Zahlen werden jede Nacht um 1 Uhr aktualisiert.
      </p>

      {rows.length === 0 ? (
        <p className="text-subtle text-sm">Noch keine Daten vorhanden.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-subtle border-b border-line">
                <th className="py-2 pr-3 font-normal w-8">#</th>
                <th className="py-2 pr-3 font-normal">Set</th>
                {COLUMNS.map((c) => (
                  <th key={c.id} className="py-2 pr-3 font-normal text-right whitespace-nowrap" title={c.title}>
                    <button type="button" onClick={() => toggle(c.id)} className="hover:text-ink">
                      {c.label}
                      {sort.id === c.id ? (sort.dir === -1 ? " ▼" : " ▲") : ""}
                    </button>
                  </th>
                ))}
                <th className="py-2 font-normal">Teuerste Karte</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((s, i) => (
                <tr key={s.id} className="border-b border-line">
                  <td className="py-2 pr-3 text-subtle">{i + 1}</td>
                  <td className="py-2 pr-3">
                    <Link to={`/sets/${s.slug ?? s.id}`} className="font-medium hover:underline">
                      {s.name}
                    </Link>
                    <span className="text-subtle text-xs"> · {s.release_date ? s.release_date.slice(0, 4) : "–"}</span>
                  </td>
                  {COLUMNS.map((c) => {
                    const v = s[c.id];
                    const isBest = c.best && s.best[c.id] != null && v === s.best[c.id];
                    return (
                      <td
                        key={c.id}
                        className={`py-2 pr-3 text-right font-mono whitespace-nowrap ${isBest ? "text-mint font-medium" : ""}`}
                      >
                        {v != null ? c.show(s) : dash}
                      </td>
                    );
                  })}
                  <td className="py-2 text-xs">
                    {s.topCard ? (
                      <Link to={`/database/${s.topCard.external_id}`} className="hover:underline">
                        {s.topCard.name} <span className="font-mono text-subtle">{eur(s.topCard.price)}</span>
                      </Link>
                    ) : (
                      dash
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
