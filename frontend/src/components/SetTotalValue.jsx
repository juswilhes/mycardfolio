import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { glow, tooltipStyle } from "../lib/chartFx.jsx";
import { getSetTotalValue } from "../api.js";
import { eur, eur0, pctSigned, formatDate } from "../lib/format.js";
import { cardPath } from "../lib/paths.js";
import RangeSelect from "./RangeSelect.jsx";
import { rangeDays, highestFirst } from "../lib/chartRange.js";
import { SetPicker, SET_COLORS } from "./SetValueAnalysis.jsx";

const DEFAULT_SETS = 6; // anfangs ausgewählt: die neuesten Sets
const TABLE_STEP = 25; // so viele Zeilen der Vergleichstabelle, dann "Alle anzeigen"
const dayLabel = (d) => new Date(`${d}T00:00:00`).toLocaleDateString("de-DE", { day: "numeric", month: "short" });
const norm = (s) => String(s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
const dash = <span className="text-subtle">–</span>;

const MODES = {
  eur: { label: "Gesamtwert in €" },
  pct: { label: "Veränderung in %" },
};

const SORTS = {
  value: { label: "Gesamtwert", fn: (a, b) => b.value - a.value },
  change: { label: "Veränderung", fn: (a, b) => (b.change ?? -Infinity) - (a.change ?? -Infinity) },
  perCard: { label: "Ø je Karte", fn: (a, b) => b.perCard - a.perCard },
  new: { label: "Neueste zuerst", fn: (a, b) => (b.release_date || "").localeCompare(a.release_date || "") },
};

// Punkte im Zeitraum; Veränderung = letzter gegen ersten Punkt darin (Verlauf kürzer als der Zeitraum: seit dem
// ersten Punkt überhaupt)
function inRange(history, days) {
  const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  return history.filter((h) => h.day >= from);
}

// Analyse "Set-Gesamtwert" (Justus 13.11.2026): Summe aller Kartenpreise eines Sets, ihr Verlauf und der Vergleich
// mit den anderen Sets. Zahlen fertig aus dem Nachtlauf (backend/services/setTotalValue.js).
export default function SetTotalValue() {
  const [rows, setRows] = useState(null);
  const [range, setRange] = useState("3m");
  const [mode, setMode] = useState("eur");
  const [selected, setSelected] = useState(null);
  const [sort, setSort] = useState("value");
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(TABLE_STEP);

  useEffect(() => {
    getSetTotalValue().then(setRows).catch(() => setRows([]));
  }, []);

  const defaultSelected = useMemo(
    () =>
      new Set(
        [...(rows ?? [])]
          .sort((a, b) => (b.release_date || "").localeCompare(a.release_date || ""))
          .slice(0, DEFAULT_SETS)
          .map((s) => s.id)
      ),
    [rows]
  );
  const sel = selected ?? defaultSelected;
  const setMany = (ids, on) =>
    setSelected((prev) => {
      const next = new Set(prev ?? defaultSelected);
      for (const id of ids) on ? next.add(id) : next.delete(id);
      return next;
    });

  const days = rangeDays(range);
  // je Set: Punkte im Zeitraum, Veränderung, Rang nach Gesamtwert
  const sets = useMemo(() => {
    const byValue = [...(rows ?? [])].sort((a, b) => b.value - a.value);
    const rank = new Map(byValue.map((s, i) => [s.id, i + 1]));
    return (rows ?? []).map((s) => {
      const points = inRange(s.history, days);
      const first = points[0];
      const last = points[points.length - 1];
      const change = first && last && first !== last && first.value > 0 ? ((last.value - first.value) / first.value) * 100 : null;
      return { ...s, points, change, since: first?.day, rank: rank.get(s.id), perCard: s.priced ? s.value / s.priced : 0 };
    });
  }, [rows, days]);

  const visible = sets.filter((s) => sel.has(s.id) && s.points.length > 0);
  const colorOf = new Map(visible.map((s, i) => [s.id, SET_COLORS[i % SET_COLORS.length]]));

  const data = useMemo(() => {
    const byDay = new Map();
    for (const s of visible) {
      const base = s.points[0]?.value;
      for (const p of s.points) {
        if (!byDay.has(p.day)) byDay.set(p.day, { day: p.day });
        byDay.get(p.day)[s.id] = mode === "pct" ? (base ? ((p.value - base) / base) * 100 : null) : p.value;
      }
    }
    return [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day));
  }, [visible, mode]);

  const tableRows = useMemo(() => {
    const q = norm(query);
    return sets.filter((s) => !q || norm(s.name).includes(q) || norm(s.series).includes(q)).sort(SORTS[sort].fn);
  }, [sets, query, sort]);

  if (rows === null) return <p className="text-subtle text-sm">Lade Auswertung …</p>;
  if (rows.length === 0) return <p className="text-subtle text-sm">Noch keine Daten. Die Auswertung entsteht im Nachtlauf.</p>;

  const fmt = (v) => (mode === "pct" ? pctSigned(v) : eur0(v));
  // kürzer als der gewählte Zeitraum? (Preise gibt es erst seit Oktober 2026)
  const firstDay = rows.reduce((m, s) => (s.history[0] && (!m || s.history[0].day < m) ? s.history[0].day : m), null);
  const shortHistory = firstDay && Date.parse(firstDay) > Date.now() - days * 24 * 60 * 60 * 1000;

  return (
    <div className="mb-10">
      <h2 className="text-sm font-medium mb-1">Set-Gesamtwert</h2>
      <p className="text-xs text-subtle mb-4 max-w-3xl">
        Was sind alle Karten eines Sets zusammen wert, und wie entwickelt sich das? Je Karte zählt eine Ausführung
        (Reverse Holos nicht extra), mit demselben Preis wie auf der Kartenseite. Kommen neue Karten dazu, zählt im
        Verlauf nur die Preisänderung – nicht der Zuwachs an Karten. Die Werte sind Marktpreise und werden jede Nacht neu
        berechnet.
      </p>

      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <select
          value={mode}
          onChange={(e) => setMode(e.target.value)}
          className="border border-line rounded-full px-3 py-1.5 text-xs bg-canvas text-ink focus:outline-none focus:border-ink"
        >
          {Object.entries(MODES).map(([v, { label }]) => (
            <option key={v} value={v}>{label}</option>
          ))}
        </select>
        <RangeSelect value={range} onChange={setRange} />
      </div>

      <SetPicker series={sets} selected={sel} colorOf={colorOf} onSetMany={setMany} />

      {visible.length === 0 ? (
        <p className="text-subtle text-sm">Kein Set ausgewählt. Wähle oben unter „Sets auswählen“ oder unten in der Tabelle.</p>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={data} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
            <XAxis dataKey="day" stroke="var(--subtle)" fontSize={11} tickLine={false} axisLine={false} tickFormatter={dayLabel} minTickGap={24} />
            <YAxis
              width={mode === "pct" ? 56 : 72}
              stroke="var(--subtle)"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              domain={["auto", "auto"]}
              tickFormatter={fmt}
            />
            <Tooltip
              itemSorter={highestFirst}
              contentStyle={tooltipStyle}
              labelStyle={{ color: "var(--subtle)" }}
              labelFormatter={(d) => formatDate(d)}
              formatter={(v, _name, item) => [fmt(v), visible.find((s) => s.id === item.dataKey)?.name]}
            />
            {visible.map((s) => (
              <Line
                key={s.id}
                type="monotone"
                dataKey={s.id}
                stroke={colorOf.get(s.id)}
                strokeWidth={2.5}
                style={glow(colorOf.get(s.id), 5)}
                dot={false}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      )}
      {shortHistory && (
        <p className="text-[11px] text-subtle mt-1">Preise liegen erst seit {formatDate(firstDay)} vor – der Verlauf wird mit jeder Nacht länger.</p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 mt-8 mb-2">
        <h3 className="text-sm font-medium">Alle Sets im Vergleich ({rows.length})</h3>
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Set oder Serie suchen"
            className="border border-line rounded-full px-3 py-1.5 text-xs bg-canvas text-ink focus:outline-none focus:border-ink w-48"
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
        </div>
      </div>
      <p className="text-[11px] text-subtle mb-2">Haken setzen = Set im Graphen zeigen. Rang = Platz nach Gesamtwert unter allen Sets.</p>

      {tableRows.length === 0 ? (
        <p className="text-subtle text-sm">Kein Set gefunden.</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-subtle border-b border-line">
                  <th className="py-2 pr-2 font-normal w-6"><span className="sr-only">Im Graphen</span></th>
                  <th className="py-2 pr-3 font-normal text-right">Rang</th>
                  <th className="py-2 pr-3 font-normal">Set</th>
                  <th className="py-2 pr-3 font-normal text-right">Gesamtwert</th>
                  <th className="py-2 pr-3 font-normal text-right">Karten</th>
                  <th className="py-2 pr-3 font-normal text-right">Ø je Karte</th>
                  <th className="py-2 pr-3 font-normal text-right">Veränderung</th>
                  <th className="py-2 font-normal">Wertvollste Karte</th>
                </tr>
              </thead>
              <tbody>
                {tableRows.slice(0, limit).map((s) => {
                  const on = sel.has(s.id);
                  return (
                    <tr key={s.id} className="border-b border-line hover:bg-surface/60">
                      <td className="py-2 pr-2">
                        <input
                          type="checkbox"
                          checked={on}
                          onChange={() => setMany([s.id], !on)}
                          aria-label={`${s.name} im Graphen zeigen`}
                          className="accent-[var(--yellow)]"
                        />
                      </td>
                      <td className="py-2 pr-3 text-right font-mono text-subtle">{s.rank}</td>
                      <td className="py-2 pr-3">
                        {colorOf.get(s.id) && (
                          <span aria-hidden="true" className="inline-block w-2.5 h-2.5 rounded-full mr-1.5 align-middle" style={{ background: colorOf.get(s.id) }} />
                        )}
                        <Link to={`/sets/${s.slug ?? s.id}`} className="font-medium hover:underline">{s.name}</Link>
                        <span className="text-subtle text-xs"> · {s.release_date ? s.release_date.slice(0, 4) : "–"}</span>
                      </td>
                      <td className="py-2 pr-3 text-right font-mono whitespace-nowrap">{eur0(s.value)}</td>
                      <td className="py-2 pr-3 text-right font-mono">
                        {s.priced}
                        {s.priced < s.cards && <span className="text-subtle text-xs" title="Karten im Set insgesamt (nicht alle haben einen Preis)"> / {s.cards}</span>}
                      </td>
                      <td className="py-2 pr-3 text-right font-mono whitespace-nowrap">{s.priced ? eur(s.perCard) : dash}</td>
                      <td className="py-2 pr-3 text-right font-mono whitespace-nowrap">
                        {s.change == null ? dash : (
                          <span className={s.change > 0.05 ? "text-mint" : s.change < -0.05 ? "text-rose" : "text-subtle"}>{pctSigned(s.change)}</span>
                        )}
                      </td>
                      <td className="py-2 text-xs max-w-[16rem]">
                        {s.topCard ? (
                          <Link to={cardPath(s.topCard)} className="hover:underline">
                            <span className="truncate">{s.topCard.name}</span>
                            <span className="text-subtle font-mono"> {eur0(s.topCard.price)} · {Math.round(s.topCard.share * 100)} %</span>
                          </Link>
                        ) : dash}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {tableRows.length > limit && (
            <button type="button" onClick={() => setLimit(tableRows.length)} className="mt-3 border border-line rounded-full px-4 py-1.5 text-xs hover:border-ink">
              Alle {tableRows.length} Sets anzeigen
            </button>
          )}
          <p className="text-[11px] text-subtle mt-2">
            Veränderung = im gewählten Zeitraum. Prozent bei der wertvollsten Karte = ihr Anteil am Gesamtwert.
          </p>
        </>
      )}
    </div>
  );
}
