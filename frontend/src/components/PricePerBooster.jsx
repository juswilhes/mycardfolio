import { Fragment, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { getPricePerBooster } from "../api.js";
import { eur } from "../lib/format.js";

const dash = <span className="text-subtle">–</span>;
const cents = (c) => (c != null ? eur(c / 100) : dash);
const norm = (s) => String(s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");

const SORTS = {
  new: { label: "Neueste zuerst", fn: (a, b) => (b.release_date || "").localeCompare(a.release_date || "") },
  cheap: { label: "Günstigster Booster", fn: (a, b) => a.best.netPerBoosterCents - b.best.netPerBoosterCents },
  // wie viel der günstigste Weg gegenüber dem Einzelbooster spart (Sets ohne Einzelbooster ans Ende)
  saving: { label: "Größte Ersparnis", fn: (a, b) => (b.saving ?? -Infinity) - (a.saving ?? -Infinity) },
  name: { label: "Name", fn: (a, b) => a.name.localeCompare(b.name) },
};

// "Delta Reign Elite Trainer Box" -> "Elite Trainer Box" (der Set-Name steht schon in der Zeile)
const short = (name, setName) => (name.startsWith(`${setName} `) ? name.slice(setName.length + 1) : name);

// Abstand zum Einzelbooster in Prozent (negativ = günstiger)
function Versus({ perBooster, single }) {
  if (!single || perBooster == null) return dash;
  const pct = ((perBooster - single) / single) * 100;
  if (Math.abs(pct) < 0.5) return <span className="text-subtle">±0 %</span>;
  return <span className={pct < 0 ? "text-mint" : "text-subtle"}>{pct < 0 ? "−" : "+"}{Math.abs(pct).toFixed(0)} %</span>;
}

// Analyse "Preis pro Booster" (Justus 13.11.2026): je Set, was ein Booster in jedem Sealed-Produkt kostet - welches
// Produkt ist der günstigste Weg an Booster? Dazu Einzelbooster- und Displaypreis je Set. Die Zahlen kommen fertig
// vom Server (services/sealedPerBooster.js, Nachtlauf); beiliegende Promo-Karten sind dort schon abgezogen.
export default function PricePerBooster() {
  const [rows, setRows] = useState(null);
  const [sort, setSort] = useState("new");
  const [query, setQuery] = useState("");
  const [onlyDisplay, setOnlyDisplay] = useState(false);
  const [open, setOpen] = useState(null);

  useEffect(() => {
    getPricePerBooster().then(setRows).catch(() => setRows([]));
  }, []);

  const shown = useMemo(() => {
    const q = norm(query);
    return (rows ?? [])
      .map((s) => {
        const best = s.products[0];
        return { ...s, best, saving: s.boosterCents ? (s.boosterCents - best.netPerBoosterCents) / s.boosterCents : null };
      })
      .filter((s) => (!q || norm(s.name).includes(q) || norm(s.series).includes(q)) && (!onlyDisplay || s.displayCents))
      .sort(SORTS[sort].fn);
  }, [rows, sort, query, onlyDisplay]);

  if (rows === null) return <p className="text-subtle text-sm">Lade Auswertung …</p>;

  return (
    <div className="mb-10">
      <h2 className="text-sm font-medium mb-1">Preis pro Booster</h2>
      <p className="text-xs text-subtle mb-4 max-w-3xl">
        Was kostet ein Booster, je nachdem, in welchem Produkt du ihn kaufst? Je Set stehen hier Einzelbooster und
        Display, dazu das Produkt mit dem günstigsten Preis je Booster. Ein Klick auf ein Set zeigt alle Produkte.
        Liegt eine Promo-Karte bei, ist ihr Wert schon abgezogen. Die Preise sind Marktpreise (jede Nacht neu) und
        gelten für versiegelte Ware; Zubehör wie Würfel, Hüllen oder Figuren ist nicht bewertet.
      </p>

      {rows.length === 0 ? (
        <p className="text-subtle text-sm">
          Noch keine Daten. Die Auswertung entsteht im Nachtlauf, sobald die Booster-Anzahl der Produkte gelesen ist.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-3">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Set oder Serie suchen"
              className="border border-line rounded-full px-3 py-1.5 text-xs bg-canvas text-ink focus:outline-none focus:border-ink w-52"
            />
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="border border-line rounded-full px-3 py-1.5 text-xs bg-canvas text-ink focus:outline-none focus:border-ink"
            >
              {Object.entries(SORTS).map(([v, { label }]) => (
                <option key={v} value={v}>Sortieren: {label}</option>
              ))}
            </select>
            <label className="flex items-center gap-1.5 text-xs text-subtle cursor-pointer">
              <input type="checkbox" checked={onlyDisplay} onChange={(e) => setOnlyDisplay(e.target.checked)} className="accent-[var(--yellow)]" />
              nur Sets mit Display
            </label>
          </div>

          {shown.length === 0 ? (
            <p className="text-subtle text-sm">Kein Set gefunden.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-subtle border-b border-line">
                    <th className="py-2 pr-3 font-normal">Set</th>
                    <th className="py-2 pr-3 font-normal text-right">Einzelbooster</th>
                    <th className="py-2 pr-3 font-normal text-right">Display</th>
                    <th className="py-2 pr-3 font-normal text-right" title="Displaypreis geteilt durch die Zahl der Booster im Display">
                      je Booster im Display
                    </th>
                    <th className="py-2 pr-3 font-normal">Günstigster Weg</th>
                    <th className="py-2 pr-3 font-normal text-right">je Booster</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((s) => (
                    <Fragment key={s.id}>
                      <tr onClick={() => setOpen(open === s.id ? null : s.id)} className="border-b border-line hover:bg-surface/60 cursor-pointer">
                        <td className="py-2 pr-3">
                          <span className="text-subtle text-xs">{open === s.id ? "▾" : "▸"} </span>
                          <span className="font-medium">{s.name}</span>
                          <span className="text-subtle text-xs"> · {s.release_date ? s.release_date.slice(0, 4) : "–"}</span>
                        </td>
                        <td className="py-2 pr-3 text-right font-mono">{cents(s.boosterCents)}</td>
                        <td className="py-2 pr-3 text-right font-mono">
                          {cents(s.displayCents)}
                          {s.displayCents != null && s.displayBoosters !== 36 && (
                            <span className="text-subtle text-xs" title="Booster in diesem Display"> ({s.displayBoosters})</span>
                          )}
                        </td>
                        <td className="py-2 pr-3 text-right font-mono">{cents(s.displayPerBoosterCents)}</td>
                        <td className="py-2 pr-3 max-w-[14rem] truncate">{short(s.best.name, s.name)}</td>
                        <td className="py-2 pr-3 text-right font-mono whitespace-nowrap">
                          <span className="text-mint">{cents(s.best.netPerBoosterCents)}</span>
                        </td>
                      </tr>
                      {open === s.id && (
                        <tr className="border-b border-line">
                          <td colSpan={6} className="py-3">
                            <ProductTable set={s} />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// Alle Produkte eines Sets, günstigster Preis je Booster zuerst
function ProductTable({ set }) {
  const anyPromo = set.products.some((p) => p.promoCents);
  const anyMixed = set.products.some((p) => p.mixed);
  return (
    <div className="bg-surface border border-line rounded-2xl px-4 py-3 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs text-subtle">{set.products.length} Produkte, günstigster Booster zuerst</p>
        <Link to={`/sets/${set.slug ?? set.id}`} className="text-xs text-subtle underline hover:text-ink">
          zum Set →
        </Link>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-subtle border-b border-line">
              <th className="py-1.5 pr-3 font-normal">Produkt</th>
              <th className="py-1.5 pr-3 font-normal text-right">Booster</th>
              <th className="py-1.5 pr-3 font-normal text-right">Preis</th>
              {anyPromo && <th className="py-1.5 pr-3 font-normal text-right" title="Wert der beiliegenden Promo-Karten, vorsichtig gerechnet">Promo-Karten</th>}
              <th className="py-1.5 pr-3 font-normal text-right">je Booster</th>
              <th className="py-1.5 font-normal text-right" title="Abstand zum Preis des Einzelboosters">ggü. Einzelbooster</th>
            </tr>
          </thead>
          <tbody>
            {set.products.map((p, i) => (
              <tr key={p.id} className="border-b border-line last:border-b-0">
                <td className="py-1.5 pr-3">
                  <Link to={`/sealed/${p.id}`} className="flex items-center gap-2 hover:underline min-w-0">
                    <span className="w-7 h-9 shrink-0 flex items-center justify-center">
                      {p.image && <img src={p.image} alt="" loading="lazy" className="max-w-full max-h-full object-contain" />}
                    </span>
                    <span className="min-w-0">
                      {short(p.name, set.name)}
                      {p.mixed && <span className="text-subtle text-xs"> *</span>}
                    </span>
                  </Link>
                </td>
                <td className="py-1.5 pr-3 text-right font-mono">{p.boosters}</td>
                <td className="py-1.5 pr-3 text-right font-mono">{cents(p.priceCents)}</td>
                {anyPromo && <td className="py-1.5 pr-3 text-right font-mono">{p.promoCents ? <>−{cents(p.promoCents)}</> : dash}</td>}
                <td className={`py-1.5 pr-3 text-right font-mono ${i === 0 ? "text-mint font-medium" : ""}`}>{cents(p.netPerBoosterCents)}</td>
                <td className="py-1.5 text-right font-mono text-xs">
                  <Versus perBooster={p.netPerBoosterCents} single={set.boosterCents} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {anyMixed && <p className="text-[11px] text-subtle mt-2">* enthält Booster aus mehreren Sets.</p>}
    </div>
  );
}
