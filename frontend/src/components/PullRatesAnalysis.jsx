import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { getPullRateOverview } from "../api.js";
import { useAuth } from "../context/AuthContext.jsx";
import PullRateEditor from "./PullRateEditor.jsx";

// Die Schreibweise der Seltenheiten ist je Set uneinheitlich ("Illustration
// rare" / "Illustration Rare") - für die Zeilen der Matrix zählt die
// kleingeschriebene Fassung, angezeigt wird die Variante mit den meisten
// Großbuchstaben (damit z. B. "RGB Rare" nicht zu "Rgb Rare" wird).
const keyOf = (r) => r.trim().toLowerCase().replace(/\s+/g, " ");
const capitals = (s) => (s.match(/[A-Z]/g) ?? []).length;

function rarityLabel(rarity, setName) {
  if (rarity === "None") return /classic collection/i.test(setName) ? "Classic Collection" : "Ohne Seltenheit";
  // Rohwerte aus der Datenquelle ("MEGA_ATTACK_RARE") lesbar machen
  if (/^[A-Z_]+$/.test(rarity)) {
    return rarity.toLowerCase().split("_").map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");
  }
  return rarity;
}

const median = (arr) => {
  if (!arr.length) return Infinity;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

// Analyse "Pull Rates": Seltenheit x Set, wie die Vergleichstabellen aus den
// Booster-Auswertungen. Zahlen sind von Hand gepflegt (Set-Seite) - es gibt
// keine offizielle Quelle. "1/205" = im Schnitt jedes 205. Pack enthält
// genau diese eine Karte; "jede" = irgendeine Karte dieser Seltenheit.
export default function PullRatesAnalysis() {
  const { user } = useAuth();
  const canEdit = !!user?.is_operator;
  const [sets, setSets] = useState(null);
  const [editing, setEditing] = useState(false);

  const load = () => getPullRateOverview().then(setSets).catch(() => setSets([]));
  useEffect(() => {
    load();
  }, []);

  const matrix = useMemo(() => {
    if (!sets) return null;
    const rows = new Map();
    for (const s of sets) {
      for (const r of s.rarities) {
        const label = rarityLabel(r.rarity, s.name);
        const k = keyOf(label);
        let row = rows.get(k);
        if (!row) {
          row = { key: k, label, cells: new Map() };
          rows.set(k, row);
        } else if (capitals(label) > capitals(row.label)) {
          row.label = label;
        }
        row.cells.set(s.id, r);
      }
    }
    const list = [...rows.values()].map((row) => {
      const specifics = [...row.cells.values()].map((c) => c.specificDenominator).filter((v) => v != null);
      return { ...row, best: specifics.length > 1 ? Math.min(...specifics) : null, sortKey: median(specifics) };
    });
    list.sort((a, b) => a.sortKey - b.sortKey || a.label.localeCompare(b.label));
    return list;
  }, [sets]);

  if (sets === null) return <p className="text-subtle text-sm">Lade Pull Rates …</p>;

  const editorToggle = canEdit && (
    <div className="mb-4">
      <button
        onClick={() => setEditing((v) => !v)}
        className="text-xs border border-line rounded-full px-3 py-1.5 hover:border-ink"
      >
        {editing ? "Pflege schließen" : "✏️ Pull Rates pflegen"}
      </button>
    </div>
  );

  if (sets.length === 0) {
    return (
      <div>
        {editorToggle}
        {editing && <PullRateEditor onSaved={load} />}
        <p className="text-subtle text-sm">Noch keine Pull Rates hinterlegt.</p>
      </div>
    );
  }

  return (
    <div className="mb-10">
      {editorToggle}
      {editing && <PullRateEditor onSaved={load} />}

      <h2 className="text-sm font-medium mb-1">🎯 Pull Rates im Vergleich</h2>
      <p className="text-xs text-subtle mb-3">
        Wie wahrscheinlich ist eine bestimmte Karte einer Seltenheit pro Pack? <b>1/205</b> heißt: im Schnitt
        jedes 205. Pack enthält genau diese Karte. Darunter in klein: die Quote für <i>irgendeine</i> Karte dieser
        Seltenheit. Grün markiert ist das Set, in dem die Karte am leichtesten zu ziehen ist. Quelle sind
        Auswertungen geöffneter Booster, von Hand gepflegt – keine offiziellen Zahlen.
      </p>
      <p className="text-xs text-subtle mb-3">
        <b>Hit Rate</b> = Chance, dass ein Pack mindestens eine besondere Karte enthält, also alles außer Common,
        Uncommon, Rare, Double Rare und Pikachu Rare. Sie wird aus den Pull Rates berechnet (Kartenanzahl der
        Seltenheit ÷ Quote pro Karte, die Seltenheiten als voneinander unabhängig gerechnet) und ist daher eine
        Näherung. Die Classic Collection steckt in den Boostern des 30th Celebration, beide Sets teilen sich deshalb
        dieselbe Hit Rate. „≥" heißt: für eine Seltenheit fehlten Angaben, die echte Chance ist höher.
      </p>

      <div className="overflow-x-auto">
        <table className="text-sm border-collapse">
          <thead>
            <tr className="text-left text-xs text-subtle border-b border-line">
              <th className="py-2 pr-4 font-normal sticky left-0 bg-canvas">Seltenheit</th>
              {sets.map((s) => (
                <th key={s.id} className="py-2 px-3 font-normal text-right whitespace-nowrap">
                  <Link to={`/sets/${s.id}`} className="hover:underline text-ink">
                    {s.name}
                  </Link>
                  <div className="text-[11px]">{s.release_date ? s.release_date.slice(0, 4) : ""}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-line">
              <td className="py-2 pr-4 sticky left-0 bg-canvas whitespace-nowrap font-medium">Hit Rate pro Pack</td>
              {sets.map((s) => (
                <td key={s.id} className="py-2 px-3 text-right">
                  {s.hitRatePct != null ? (
                    <>
                      <div className="font-mono font-medium">
                        {s.hitRateComplete ? "" : "≥ "}
                        {s.hitRatePct.toLocaleString("de-DE", { minimumFractionDigits: 1 })} %
                      </div>
                      <div className="text-[11px] text-subtle">
                        jedes {(100 / s.hitRatePct).toLocaleString("de-DE", { maximumFractionDigits: 1 })}. Pack
                      </div>
                    </>
                  ) : (
                    <span className="text-subtle">–</span>
                  )}
                </td>
              ))}
            </tr>
            {matrix.map((row) => (
              <tr key={row.key} className="border-b border-line">
                <td className="py-2 pr-4 sticky left-0 bg-canvas whitespace-nowrap">{row.label}</td>
                {sets.map((s) => {
                  const c = row.cells.get(s.id);
                  if (!c) return <td key={s.id} className="py-2 px-3 text-right text-subtle">–</td>;
                  const isBest = row.best != null && c.specificDenominator === row.best;
                  return (
                    <td key={s.id} className="py-2 px-3 text-right">
                      <div className={`font-mono ${isBest ? "text-mint font-medium" : ""}`}>
                        {c.specificDenominator != null ? `1/${c.specificDenominator}` : <span className="text-subtle">–</span>}
                      </div>
                      {c.anyDenominator != null && (
                        <div className="text-[11px] text-subtle font-mono">jede 1/{c.anyDenominator}</div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
