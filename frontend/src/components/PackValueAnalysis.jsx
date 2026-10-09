import { Fragment, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { getPackValueAnalysis } from "../api.js";
import { eur } from "../lib/format.js";
import { rarityLabel } from "../lib/rarity.js";

const SORTS = {
  ratio: { label: "Wert im Verhältnis zum Boosterpreis", fn: (a, b) => (b.ratio ?? -1) - (a.ratio ?? -1) },
  value: { label: "Wert pro Pack", fn: (a, b) => b.packValue - a.packValue },
  new: { label: "Neueste zuerst", fn: (a, b) => (b.release_date || "").localeCompare(a.release_date || "") },
};

const dash = <span className="text-subtle">–</span>;

// Analyse "Wert pro Pack": was ist ein Booster im Schnitt wert (Pull Rates x
// aktuelle Kartenpreise) und lohnt sich damit der Kauf von Booster/Display?
// Die Rechnung steht in backend/services/marketStats.js getPackValueAnalysis.
export default function PackValueAnalysis() {
  const [rows, setRows] = useState(null);
  const [sort, setSort] = useState("ratio");
  const [open, setOpen] = useState(null);

  useEffect(() => {
    getPackValueAnalysis().then(setRows).catch(() => setRows([]));
  }, []);

  const shown = useMemo(() => {
    if (!rows) return [];
    return rows
      .map((s) => {
        const booster = s.boosterPriceCents != null ? s.boosterPriceCents / 100 : null;
        const box = s.boxPriceCents != null ? s.boxPriceCents / 100 : null;
        const boxValue = s.packValue * s.packsPerBox;
        return {
          ...s,
          booster,
          box,
          boxValue,
          ratio: booster ? (s.packValue / booster) * 100 : null,
          boxRatio: box ? (boxValue / box) * 100 : null,
        };
      })
      .sort(SORTS[sort].fn);
  }, [rows, sort]);

  if (rows === null) return <p className="text-subtle text-sm">Lade Auswertung …</p>;

  const pct = (v) =>
    v == null ? dash : (
      <span className={v >= 100 ? "text-mint" : ""}>{v.toLocaleString("de-DE", { maximumFractionDigits: 0 })} %</span>
    );

  return (
    <div className="mb-10">
      <h2 className="text-sm font-medium mb-1">Wert pro Pack</h2>
      <p className="text-xs text-subtle mb-3">
        Was ist ein Booster im Schnitt wert? Für jede Seltenheit mit hinterlegter Pull Rate zählt die Summe aller
        Kartenpreise dieser Seltenheit geteilt durch die Quote pro Karte (z. B. 1/480). Daraus ergibt sich der
        erwartete Wert pro Pack; ein Display rechnen wir mit {rows[0]?.packsPerBox ?? 36} Boostern. Über 100 % heißt:
        im Schnitt ist der Inhalt mehr wert als der Kaufpreis. Klick auf ein Set zeigt, welche Seltenheit wie viel
        beiträgt.
      </p>
      <p className="text-xs text-subtle mb-3">
        <b>Wichtig:</b> Common, Uncommon, Rare und Reverse Holos sind nicht eingerechnet (dafür gibt es keine Pull
        Rates) – der Wert ist eine <i>Untergrenze</i>, meist aber nur um wenige Cent. Es ist ein Durchschnitt über
        viele Packs: Einzelne Packs oder Displays weichen stark ab. Verkaufsgebühren, Versand und Kartenzustand sind
        nicht berücksichtigt. Die Boosterpreise stehen unter „Booster vs. Top-Karten".
      </p>

      {rows.length === 0 ? (
        <p className="text-subtle text-sm">Noch keine Pull Rates hinterlegt.</p>
      ) : (
        <>
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
                  <th className="py-2 pr-3 font-normal text-right">Wert pro Pack</th>
                  <th className="py-2 pr-3 font-normal text-right">Booster</th>
                  <th className="py-2 pr-3 font-normal text-right">% vom Booster</th>
                  <th className="py-2 pr-3 font-normal text-right">Wert pro Box</th>
                  <th className="py-2 pr-3 font-normal text-right">Box</th>
                  <th className="py-2 pr-3 font-normal text-right">% von der Box</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((s) => (
                  <Fragment key={s.id}>
                    <tr
                      onClick={() => setOpen(open === s.id ? null : s.id)}
                      className="border-b border-line hover:bg-surface/60 cursor-pointer"
                    >
                      <td className="py-2 pr-3">
                        <span className="text-subtle text-xs">{open === s.id ? "▾" : "▸"} </span>
                        <span className="font-medium">{s.name}</span>
                        <span className="text-subtle text-xs"> · {s.release_date ? s.release_date.slice(0, 4) : "–"}</span>
                      </td>
                      <td className="py-2 pr-3 text-right font-mono">
                        {s.complete ? "" : "≥ "}
                        {eur(s.packValue)}
                      </td>
                      <td className="py-2 pr-3 text-right font-mono">{s.booster != null ? eur(s.booster) : dash}</td>
                      <td className="py-2 pr-3 text-right font-mono">{pct(s.ratio)}</td>
                      <td className="py-2 pr-3 text-right font-mono">{s.box != null ? eur(s.boxValue) : dash}</td>
                      <td className="py-2 pr-3 text-right font-mono">{s.box != null ? eur(s.box) : dash}</td>
                      <td className="py-2 pr-3 text-right font-mono">{pct(s.boxRatio)}</td>
                    </tr>
                    {open === s.id && (
                      <tr className="border-b border-line">
                        <td colSpan={7} className="py-4">
                          <table className="text-xs">
                            <thead>
                              <tr className="text-left text-subtle">
                                <th className="pr-5 py-1 font-normal">Seltenheit</th>
                                <th className="pr-5 py-1 font-normal text-right">Karten</th>
                                <th className="pr-5 py-1 font-normal text-right">Ø Preis</th>
                                <th className="pr-5 py-1 font-normal text-right">Quote pro Karte</th>
                                <th className="pr-5 py-1 font-normal text-right">Beitrag pro Pack</th>
                                <th className="py-1 font-normal text-right">Anteil</th>
                              </tr>
                            </thead>
                            <tbody>
                              {s.rarities.map((r) => (
                                <tr key={r.rarity} className="border-t border-line">
                                  <td className="pr-5 py-1">{rarityLabel(r.rarity)}</td>
                                  <td className="pr-5 py-1 text-right font-mono">
                                    {r.cards}
                                    {r.pricedCards < r.cards && (
                                      <span className="text-subtle" title="So viele Karten haben einen Preis"> ({r.pricedCards})</span>
                                    )}
                                  </td>
                                  <td className="pr-5 py-1 text-right font-mono">{r.avgPrice != null ? eur(r.avgPrice) : dash}</td>
                                  <td className="pr-5 py-1 text-right font-mono">
                                    {r.specificDenominator != null
                                      ? `1/${r.specificDenominator}`
                                      : r.anyDenominator != null
                                      ? `jede 1/${r.anyDenominator}`
                                      : dash}
                                  </td>
                                  <td className="pr-5 py-1 text-right font-mono">
                                    {r.valuePerPack != null ? eur(r.valuePerPack) : <span className="text-subtle">keine Angabe</span>}
                                  </td>
                                  <td className="py-1 text-right font-mono text-subtle">
                                    {r.valuePerPack != null && s.packValue
                                      ? `${((r.valuePerPack / s.packValue) * 100).toLocaleString("de-DE", { maximumFractionDigits: 0 })} %`
                                      : ""}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          {s.notIncluded.length > 0 && (
                            <p className="text-[11px] text-subtle mt-2">
                              Nicht eingerechnet: {s.notIncluded.map((r) => rarityLabel(r)).join(", ")}.
                            </p>
                          )}
                          <p className="text-[11px] mt-2">
                            <Link to={`/sets/${s.slug ?? s.id}`} className="text-subtle underline hover:text-ink">
                              zum Set →
                            </Link>
                          </p>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
