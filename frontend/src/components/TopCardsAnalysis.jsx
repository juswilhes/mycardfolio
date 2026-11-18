import { Fragment, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { glow, tooltipStyle } from "../lib/chartFx.jsx";
import { getTopCards, getTopCardsHistory } from "../api.js";
import { eur, eur0, pctSigned, formatDate } from "../lib/format.js";
import { cardPath } from "../lib/paths.js";
import RangeSelect from "./RangeSelect.jsx";
import { rangeDays, highestFirst } from "../lib/chartRange.js";
import { SetPicker, SET_COLORS } from "./SetValueAnalysis.jsx";

const SIZES = [
  { id: "5", label: "Top 5" },
  { id: "10", label: "Top 10" },
  { id: "20", label: "Top 20" },
];
const DEFAULT_SETS = 6;
const TABLE_STEP = 25;
const dash = <span className="text-subtle">–</span>;
const norm = (s) => String(s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
const dayLabel = (d) => new Date(`${d}T00:00:00`).toLocaleDateString("de-DE", { day: "numeric", month: "short" });
const monthLabel = (m) => new Date(`${m}-01T00:00:00`).toLocaleDateString("de-DE", { month: "short", year: "2-digit" });
const selectCls = "border border-line rounded-full px-3 py-1.5 text-xs bg-canvas text-ink focus:outline-none focus:border-ink";
const pctClass = (v) => (v > 0.05 ? "text-mint" : v < -0.05 ? "text-rose" : "text-subtle");

const SORTS = {
  value: { label: "Wert", fn: (a, b) => b.t.value - a.t.value },
  change: { label: "Veränderung", fn: (a, b) => (b.change ?? -Infinity) - (a.change ?? -Infinity) },
  new: { label: "Neueste zuerst", fn: (a, b) => (b.release_date || "").localeCompare(a.release_date || "") },
};

// Analyse "Top-Karten" (Justus 18.11.2026): je Set der Wert der heute wertvollsten 5/10/20 Karten, Verlauf als
// Graph, monatliche Veränderung in % als Balken und alle Sets im Vergleich. Zahlen aus dem Nachtlauf
// (backend/services/setTopValue.js); der Tagesverlauf und die Kartenliste werden nur für gewählte Sets geladen.
export default function TopCardsAnalysis() {
  const [rows, setRows] = useState(null);
  const [size, setSize] = useState("10");
  const [range, setRange] = useState("3m");
  const [mode, setMode] = useState("eur");
  const [selected, setSelected] = useState(null);
  const [details, setDetails] = useState({}); // setId -> { cards, history }
  const [sort, setSort] = useState("value");
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(TABLE_STEP);
  const [open, setOpen] = useState(null);

  useEffect(() => {
    getTopCards().then(setRows).catch(() => setRows([]));
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

  // Verlauf + Kartenliste nur für gewählte bzw. aufgeklappte Sets nachladen
  const wanted = useMemo(() => [...sel, ...(open ? [open] : [])].filter((id) => !details[id]), [sel, open, details]);
  useEffect(() => {
    if (!wanted.length) return;
    getTopCardsHistory(wanted)
      .then((list) =>
        setDetails((prev) => {
          const next = { ...prev };
          for (const d of list) next[d.id] = d;
          for (const id of wanted) next[id] ??= { cards: [], history: {} };
          return next;
        })
      )
      .catch(() => {});
  }, [wanted.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  const days = rangeDays(range);
  const sets = useMemo(() => {
    const list = (rows ?? []).map((s) => {
      const t = s.tops[size];
      return { ...s, t, change: t.change[days] ?? null, points: t.value > 0 ? [t.value] : [] };
    });
    const rank = new Map([...list].sort((a, b) => b.t.value - a.t.value).map((s, i) => [s.id, i + 1]));
    return list.map((s) => ({ ...s, rank: rank.get(s.id) }));
  }, [rows, size, days]);

  const visible = sets.filter((s) => sel.has(s.id) && s.t.value > 0);
  const colorOf = new Map(visible.map((s, i) => [s.id, SET_COLORS[i % SET_COLORS.length]]));

  const lineData = useMemo(() => {
    const from = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
    const byDay = new Map();
    for (const s of visible) {
      const pts = (details[s.id]?.history?.[size] ?? []).filter((p) => p.day >= from);
      const base = pts[0]?.value;
      for (const p of pts) {
        if (!byDay.has(p.day)) byDay.set(p.day, { day: p.day });
        byDay.get(p.day)[s.id] = mode === "pct" ? (base ? ((p.value - base) / base) * 100 : null) : p.value;
      }
    }
    return [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day));
  }, [visible, details, size, mode, days]);

  // Monatliche Veränderung: eine Balkengruppe je Monat, ein Balken je gewähltem Set
  const monthData = useMemo(() => {
    const from = new Date(Date.now() - days * 86400000).toISOString().slice(0, 7);
    const byMonth = new Map();
    for (const s of visible) {
      for (const m of s.t.months) {
        if (m.month < from || m.pct == null) continue;
        if (!byMonth.has(m.month)) byMonth.set(m.month, { month: m.month });
        byMonth.get(m.month)[s.id] = m.pct;
        if (m.partial) byMonth.get(m.month).partial = true;
      }
    }
    return [...byMonth.values()].sort((a, b) => a.month.localeCompare(b.month));
  }, [visible, days]);

  const tableRows = useMemo(() => {
    const q = norm(query);
    return sets.filter((s) => !q || norm(s.name).includes(q) || norm(s.series).includes(q)).sort(SORTS[sort].fn);
  }, [sets, query, sort]);

  if (rows === null) return <p className="text-subtle text-sm">Lade Auswertung …</p>;
  if (rows.length === 0) return <p className="text-subtle text-sm">Noch keine Daten. Die Auswertung entsteht im Nachtlauf.</p>;

  const n = Number(size);
  const fmt = (v) => (mode === "pct" ? pctSigned(v) : eur0(v));
  const firstDay = rows.reduce((m, s) => (s.firstDay && (!m || s.firstDay < m) ? s.firstDay : m), null);
  const nameOf = (id) => visible.find((s) => s.id === id)?.name;
  const loading = visible.some((s) => !details[s.id]);

  return (
    <div className="mb-10">
      <h2 className="text-sm font-medium mb-1">Top-Karten je Set</h2>
      <p className="text-xs text-subtle mb-4 max-w-3xl">
        Was sind die {n} wertvollsten Karten eines Sets zusammen wert, und wie haben sie sich entwickelt? Gezählt werden
        die Karten, die heute die teuersten sind, mit demselben Preis wie auf der Kartenseite (je Karte eine Ausführung).
        Die Werte werden jede Nacht neu berechnet.
      </p>

      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex flex-wrap items-center gap-2">
          <RangeSelect value={size} onChange={setSize} options={SIZES} />
          <select value={mode} onChange={(e) => setMode(e.target.value)} className={selectCls}>
            <option value="eur">Wert in €</option>
            <option value="pct">Veränderung in %</option>
          </select>
        </div>
        <RangeSelect value={range} onChange={setRange} />
      </div>

      <SetPicker series={sets} selected={sel} colorOf={colorOf} onSetMany={setMany} />

      {visible.length === 0 ? (
        <p className="text-subtle text-sm">Kein Set ausgewählt. Wähle oben unter „Sets auswählen“ oder unten in der Tabelle.</p>
      ) : (
        <>
          <h3 className="text-xs text-subtle mb-1">Wert der Top {n} im Verlauf</h3>
          {loading && lineData.length === 0 ? (
            <p className="text-subtle text-sm h-80 sm:h-[560px]">Lade Verlauf …</p>
          ) : (
            <div className="h-80 sm:h-[560px]"><ResponsiveContainer width="100%" height="100%">
              <LineChart data={lineData} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
                <XAxis dataKey="day" stroke="var(--subtle)" fontSize={11} tickLine={false} axisLine={false} tickFormatter={dayLabel} minTickGap={24} />
                <YAxis width={mode === "pct" ? 56 : 72} stroke="var(--subtle)" fontSize={11} tickLine={false} axisLine={false} domain={["auto", "auto"]} tickFormatter={fmt} />
                <Tooltip
                  itemSorter={highestFirst}
                  contentStyle={tooltipStyle}
                  labelStyle={{ color: "var(--subtle)" }}
                  labelFormatter={(d) => formatDate(d)}
                  formatter={(v, _n, item) => [fmt(v), nameOf(item.dataKey)]}
                />
                {visible.map((s) => (
                  <Line key={s.id} type="monotone" dataKey={s.id} stroke={colorOf.get(s.id)} strokeWidth={2.5} style={glow(colorOf.get(s.id), 5)} dot={false} connectNulls />
                ))}
              </LineChart>
            </ResponsiveContainer></div>
          )}

          <h3 className="text-xs text-subtle mt-6 mb-1">Monatliche Veränderung der Top {n} in %</h3>
          {monthData.length === 0 ? (
            <p className="text-subtle text-sm">Noch kein Monat mit Werten.</p>
          ) : (
            <div className="h-72 sm:h-[440px]"><ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthData} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
                <XAxis
                  dataKey="month"
                  stroke="var(--subtle)"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(m) => `${monthLabel(m)}${monthData.find((x) => x.month === m)?.partial ? "*" : ""}`}
                />
                <YAxis width={56} stroke="var(--subtle)" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => pctSigned(v)} />
                <ReferenceLine y={0} stroke="var(--line)" />
                <Tooltip
                  cursor={{ fill: "var(--line)", opacity: 0.3 }}
                  contentStyle={tooltipStyle}
                  labelStyle={{ color: "var(--subtle)" }}
                  labelFormatter={(m) => `${monthLabel(m)}${monthData.find((x) => x.month === m)?.partial ? " (Teilmonat)" : ""}`}
                  formatter={(v, _n, item) => [pctSigned(v), nameOf(item.dataKey)]}
                />
                {visible.map((s) => (
                  <Bar key={s.id} dataKey={s.id} fill={colorOf.get(s.id)} radius={[3, 3, 3, 3]} style={glow(colorOf.get(s.id), 4)} maxBarSize={28} />
                ))}
              </BarChart>
            </ResponsiveContainer></div>
          )}
        </>
      )}
      {firstDay && (
        <p className="text-[11px] text-subtle mt-1">
          Preise liegen seit {formatDate(firstDay)} vor. * = Teilmonat (Veränderung ab dem ersten Wert im Monat). Jeder
          weitere Monat kommt automatisch dazu.
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 mt-8 mb-2">
        <h3 className="text-sm font-medium">Alle Sets im Vergleich ({rows.length})</h3>
        <div className="flex flex-wrap items-center gap-2">
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Set oder Serie suchen" className={`${selectCls} w-48`} />
          <select value={sort} onChange={(e) => setSort(e.target.value)} className={selectCls}>
            {Object.entries(SORTS).map(([v, { label }]) => (
              <option key={v} value={v}>Sortieren: {label}</option>
            ))}
          </select>
        </div>
      </div>
      <p className="text-[11px] text-subtle mb-2">Haken = Set in den Graphen. Klick auf ein Set zeigt seine Top {n}. Veränderung = im gewählten Zeitraum.</p>

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
                  <th className="py-2 pr-3 font-normal text-right">Top {n}</th>
                  <th className="py-2 pr-3 font-normal text-right">Ø je Karte</th>
                  <th className="py-2 pr-3 font-normal text-right">Veränderung</th>
                  <th className="py-2 font-normal">Wertvollste Karte</th>
                </tr>
              </thead>
              <tbody>
                {tableRows.slice(0, limit).map((s) => {
                  const on = sel.has(s.id);
                  const isOpen = open === s.id;
                  return (
                    <Fragment key={s.id}>
                      <tr onClick={() => setOpen(isOpen ? null : s.id)} className="border-b border-line hover:bg-surface/60 cursor-pointer">
                        <td className="py-2 pr-2" onClick={(e) => e.stopPropagation()}>
                          <input type="checkbox" checked={on} onChange={() => setMany([s.id], !on)} aria-label={`${s.name} im Graphen zeigen`} className="accent-[var(--yellow)]" />
                        </td>
                        <td className="py-2 pr-3 text-right font-mono text-subtle">{s.rank}</td>
                        <td className="py-2 pr-3">
                          <span className="text-subtle text-xs">{isOpen ? "▾" : "▸"} </span>
                          {colorOf.get(s.id) && (
                            <span aria-hidden="true" className="inline-block w-2.5 h-2.5 rounded-full mr-1.5 align-middle" style={{ background: colorOf.get(s.id) }} />
                          )}
                          <span className="font-medium">{s.name}</span>
                          <span className="text-subtle text-xs"> · {s.release_date ? s.release_date.slice(0, 4) : "–"}</span>
                        </td>
                        <td className="py-2 pr-3 text-right font-mono whitespace-nowrap">
                          {eur0(s.t.value)}
                          {s.t.count < n && <span className="text-subtle text-xs" title="Nur so viele Karten mit Preis"> ({s.t.count})</span>}
                        </td>
                        <td className="py-2 pr-3 text-right font-mono whitespace-nowrap">{eur(s.t.value / s.t.count)}</td>
                        <td className="py-2 pr-3 text-right font-mono whitespace-nowrap">
                          {s.change == null ? dash : <span className={pctClass(s.change)}>{pctSigned(s.change)}</span>}
                        </td>
                        <td className="py-2 text-xs max-w-[14rem] truncate">
                          {s.topCard ? (
                            <>
                              {s.topCard.name} <span className="text-subtle font-mono">{eur0(s.topCard.price)}</span>
                            </>
                          ) : dash}
                        </td>
                      </tr>
                      {isOpen && (
                        <tr className="border-b border-line">
                          <td colSpan={7} className="py-4">
                            <div className="flex items-center justify-between mb-3">
                              <p className="text-xs text-subtle">Die {n} wertvollsten Karten</p>
                              <Link to={`/sets/${s.slug ?? s.id}`} className="text-xs text-subtle underline hover:text-ink">zum Set →</Link>
                            </div>
                            {!details[s.id] ? (
                              <p className="text-xs text-subtle">Lade Karten …</p>
                            ) : (
                              <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-7 gap-3">
                                {(details[s.id].cards ?? []).slice(0, n).map((c) => (
                                  <Link key={c.external_id} to={cardPath(c)} className="flex flex-col">
                                    <img src={c.image_small} alt={`${c.name} (Englisch)`} loading="lazy" width={245} height={342} className="w-full h-auto rounded-xl border border-line mb-1 shadow-sm" />
                                    <p className="text-[11px] font-medium truncate">{c.name}</p>
                                    <p className="text-[11px] font-mono text-subtle">{eur(c.price)}</p>
                                  </Link>
                                ))}
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
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
        </>
      )}
    </div>
  );
}
