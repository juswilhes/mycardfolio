import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { cardPath } from "../lib/paths.js";
import { Link } from "react-router-dom";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { glow, tooltipStyle } from "../lib/chartFx.jsx";
import { getSetValueAnalysis, getSets, updateSetPrices } from "../api.js";
import { useAuth } from "../context/AuthContext.jsx";
import { eur } from "../lib/format.js";
import RangeSelect from "./RangeSelect.jsx";
import { RANGES, rangeDays, withinDays, highestFirst } from "../lib/chartRange.js";

const SORTS = {
  box_ratio: { label: "Top 20 im Verhältnis zum Boxpreis", fn: (a, b) => (b.boxRatio ?? -1) - (a.boxRatio ?? -1) },
  booster_ratio: { label: "Top 20 in Boostern", fn: (a, b) => (b.boosterRatio ?? -1) - (a.boosterRatio ?? -1) },
  top20: { label: "Wert der Top 20", fn: (a, b) => b.top20Value - a.top20Value },
  new: { label: "Neueste zuerst", fn: (a, b) => (b.release_date || "").localeCompare(a.release_date || "") },
};

const METRICS = {
  booster: {
    label: "Top 20 in Boostern",
    value: (h) => (h.boosterPriceCents ? h.top20Value / (h.boosterPriceCents / 100) : null),
    format: (v) => v.toFixed(1),
  },
  box: {
    label: "Top 20 in % des Boxpreises",
    value: (h) => (h.boxPriceCents ? (h.top20Value / (h.boxPriceCents / 100)) * 100 : null),
    format: (v) => `${v.toFixed(0)} %`,
  },
  value: { label: "Wert der Top 20 (€)", value: (h) => h.top20Value, format: (v) => eur(v) },
};

const monthLabel = (m) =>
  new Date(`${m}-01T00:00:00`).toLocaleDateString("de-DE", { month: "short", year: "2-digit" });

// Analyse "Booster vs. Top-Karten": lohnt sich der Kauf eines Displays/Boosters im
// Verhältnis zu dem, was die 20 teuersten Karten des Sets wert sind? Preise
// für Box/Booster pflegt der Betreiber von Hand hier in der Analyse (keine
// freie API-Quelle) - Sondersets ohne Display haben nur einen Boosterpreis.
// Der Verlauf kommt aus den Monatsständen (jeweils am 1., siehe
// backend/services/setValueSnapshots.js).
export default function SetValueAnalysis() {
  const { user } = useAuth();
  const canEdit = !!user?.is_operator;
  const [rows, setRows] = useState(null);
  const [sort, setSort] = useState("new");
  const [open, setOpen] = useState(null);
  const [editing, setEditing] = useState(false);

  const load = () => getSetValueAnalysis().then(setRows).catch(() => setRows([]));
  useEffect(() => {
    load();
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

  const editorToggle = canEdit && (
    <div className="mb-4">
      <button
        onClick={() => setEditing((v) => !v)}
        className="text-xs border border-line rounded-full px-3 py-1.5 hover:border-ink"
      >
        {editing ? "Pflege schließen" : "Preise pflegen"}
      </button>
    </div>
  );

  return (
    <div className="mb-10">
      {editorToggle}
      {editing && <PriceEditor onSaved={load} />}

      <h2 className="text-sm font-medium mb-1">Booster vs. Top-Karten</h2>
      <p className="text-xs text-subtle mb-3">
        Wie viel sind die 20 teuersten Karten eines Sets wert – im Verhältnis zum Preis eines Displays
        bzw. eines einzelnen Boosters? Alle Preise sind aktuell (jede Nacht neu). Sondersets ohne Display (z. B. 30th Celebration) haben nur einen Boosterpreis. Klick auf
        ein Set zeigt die 20 Karten.
      </p>

      {rows.length === 0 ? (
        <p className="text-subtle text-sm">Noch keine Preise hinterlegt.</p>
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

          <ValueBars rows={shown} />

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
                    {open === s.id && (
                      <tr className="border-b border-line">
                        <td colSpan={6} className="py-4">
                          <div className="flex items-center justify-between mb-3">
                            <p className="text-xs text-subtle">Die {s.topCards.length} teuersten Karten</p>
                            <Link to={`/sets/${s.slug ?? s.id}`} className="text-xs text-subtle underline hover:text-ink">
                              zum Set →
                            </Link>
                          </div>
                          <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-7 gap-3">
                            {s.topCards.map((c) => (
                              <Link key={c.external_id} to={cardPath(c)} className="flex flex-col">
                                <img
                                  src={c.image_small}
                                  alt={`${c.name} (Englisch)`}
                                  className="rounded-xl border border-line mb-1 shadow-sm"
                                />
                                <p className="text-[11px] font-medium truncate">{c.name}</p>
                                <p className="text-[11px] font-mono text-subtle">{eur(c.price)}</p>
                              </Link>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>

          <HistoryChart rows={shown} />
        </>
      )}
    </div>
  );
}

// Farben für die übereinandergelegten Sets (wie in der Statistik).
const SET_COLORS = ["#f8c93a", "#5a9bff", "#35d488", "#ff6b81", "#c98bff", "#f2994a", "#56ccf2", "#b0a08a", "#e86bd6", "#9ad14b", "#ff9f7a", "#7f8cff"];
// So viele Sets (die neuesten) sind im Verlauf anfangs ausgewählt - 100+ Linien auf einmal liest niemand
const DEFAULT_SETS = 6;
// Bis zu so vielen ausgewählten Sets stehen sie einzeln als Marken unter der Auswahl
const MAX_CHIPS = 12;

// Verlauf der Monatsstände - beliebig viele Sets übereinandergelegt, je Set
// eine Linie in eigener Farbe; per Klick auf den Set-Namen ein-/ausblendbar.
// Der erste Stand entsteht beim ersten Aufruf nach dem Deploy bzw. sobald
// Preise eingetragen sind, danach automatisch am 1. jedes Monats.
const HISTORY_RANGES = RANGES.filter((r) => ["3m", "6m", "12m"].includes(r.id));

// Balkendiagramm (Justus 30.10.2026): je Set Displaypreis neben dem Wert der 20 teuersten Karten, in der
// Reihenfolge der Tabelle. Nur Sets mit Display - ohne Display gibt es nichts Vergleichbares.
const BAR_COLORS = { box: "#5a9bff", top20: "#f8c93a" };
const BARS_FIRST = 12;
const ROW_HEIGHT = 44;

function ValueBars({ rows }) {
  const [all, setAll] = useState(false);
  const withBox = rows.filter((s) => s.box != null && s.top20Count);
  if (!withBox.length) return null;
  const data = (all ? withBox : withBox.slice(0, BARS_FIRST)).map((s) => ({
    name: s.name,
    box: s.box,
    top20: Math.round(s.top20Value * 100) / 100,
  }));
  return (
    <div className="mb-6">
      <ResponsiveContainer width="100%" height={data.length * ROW_HEIGHT + 40}>
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 12, left: 4, bottom: 0 }} barGap={2}>
          <XAxis
            type="number"
            stroke="var(--subtle)"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => eur(v).replace(",00", "")}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={130}
            stroke="var(--subtle)"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            interval={0}
          />
          <Tooltip
            cursor={{ fill: "var(--line)", opacity: 0.4 }}
            contentStyle={tooltipStyle}
            labelStyle={{ color: "var(--subtle)" }}
            formatter={(v, name) => [eur(v), name]}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="box" name="Display" fill={BAR_COLORS.box} radius={[0, 4, 4, 0]} barSize={12} style={glow(BAR_COLORS.box, 4)} />
          <Bar dataKey="top20" name="Top 20 Karten" fill={BAR_COLORS.top20} radius={[0, 4, 4, 0]} barSize={12} style={glow("var(--yellow)", 4)} />
        </BarChart>
      </ResponsiveContainer>
      {withBox.length > BARS_FIRST && (
        <button onClick={() => setAll((v) => !v)} className="text-xs text-subtle underline hover:text-ink mt-1">
          {all ? "Weniger anzeigen" : `Alle ${withBox.length} Sets anzeigen`}
        </button>
      )}
    </div>
  );
}

function HistoryChart({ rows }) {
  const [range, setRange] = useState("12m");
  const withHistory = useMemo(() => rows.filter((s) => s.history.length > 0), [rows]);
  const [metric, setMetric] = useState("booster");
  // null = noch nichts selbst gewählt -> die neuesten Sets (defaultSelected)
  const [selected, setSelected] = useState(null);
  const m = METRICS[metric];
  const defaultSelected = useMemo(
    () =>
      new Set(
        [...withHistory]
          .sort((a, b) => (b.release_date || "").localeCompare(a.release_date || ""))
          .slice(0, DEFAULT_SETS)
          .map((s) => s.id)
      ),
    [withHistory]
  );
  const sel = selected ?? defaultSelected;

  // Je Set die Werte der gewählten Kennzahl (Sets ohne passenden Preis, z. B.
  // ohne Boosterpreis bei "in Boostern", haben keine Werte)
  const series = useMemo(
    () =>
      withHistory.map((s) => ({
        id: s.id,
        name: s.name,
        series: s.series,
        points: withinDays(s.history, rangeDays(range), (h) => h.month)
          .map((h) => ({ month: h.month, value: m.value(h) }))
          .filter((p) => p.value != null),
      })),
    [withHistory, m, range]
  );

  const visible = series.filter((s) => s.points.length > 0 && sel.has(s.id));
  // Farben nach Reihenfolge der AUSGEWÄHLTEN Sets: so sind die ersten 12 Linien immer unterscheidbar
  const colorOf = new Map(visible.map((s, i) => [s.id, SET_COLORS[i % SET_COLORS.length]]));

  const data = useMemo(() => {
    const byMonth = new Map();
    for (const s of visible) {
      for (const p of s.points) {
        if (!byMonth.has(p.month)) byMonth.set(p.month, { month: p.month });
        byMonth.get(p.month)[s.id] = p.value;
      }
    }
    return [...byMonth.values()].sort((a, b) => a.month.localeCompare(b.month));
  }, [visible]);

  // Mehrere Sets auf einmal an- oder abwählen (einzelnes Set, ganze Serie, alle)
  const setMany = (ids, on) =>
    setSelected((prev) => {
      const next = new Set(prev ?? defaultSelected);
      for (const id of ids) on ? next.add(id) : next.delete(id);
      return next;
    });

  return (
    <div className="mt-10">
      <h2 className="text-sm font-medium mb-1">Verlauf</h2>
      <p className="text-xs text-subtle mb-3">
        Ein Stand je Monat (der laufende Monat wird jede Nacht aktualisiert) – so siehst du, ob sich ein Set im
        Verhältnis zum Booster-/Boxpreis lohnender oder weniger lohnend entwickelt. Mehrere Sets lassen sich
        übereinanderlegen.
      </p>

      {withHistory.length === 0 ? (
        <p className="text-subtle text-sm">Noch kein Stand gespeichert.</p>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <select
              value={metric}
              onChange={(e) => setMetric(e.target.value)}
              className="border border-line rounded-full px-3 py-1.5 text-xs bg-canvas text-ink focus:outline-none focus:border-ink"
            >
              {Object.entries(METRICS).map(([v, { label }]) => (
                <option key={v} value={v}>{label}</option>
              ))}
            </select>
            <RangeSelect value={range} onChange={setRange} options={HISTORY_RANGES} />
          </div>

          <SetPicker series={series} selected={sel} colorOf={colorOf} onSetMany={setMany} />

          {visible.length === 0 ? (
            <p className="text-subtle text-sm">Kein Set ausgewählt bzw. für diese Kennzahl liegt noch kein Preis vor.</p>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={data} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
                  <XAxis
                    dataKey="month"
                    stroke="var(--subtle)"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={monthLabel}
                  />
                  <YAxis
                    width={64}
                    stroke="var(--subtle)"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    domain={["auto", "auto"]}
                    tickFormatter={(v) => m.format(v)}
                  />
                  <Tooltip
                    itemSorter={highestFirst}
                    contentStyle={tooltipStyle}
                    labelStyle={{ color: "var(--subtle)" }}
                    labelFormatter={monthLabel}
                    formatter={(v, _name, item) => [m.format(v), visible.find((s) => s.id === item.dataKey)?.name]}
                  />
                  {visible.map((s) => (
                    <Line
                      key={s.id}
                      type="monotone"
                      dataKey={s.id}
                      stroke={colorOf.get(s.id)}
                      strokeWidth={2.5}
                      style={glow(colorOf.get(s.id), 5)}
                      dot
                      connectNulls
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
              {data.length < 2 && (
                <p className="text-subtle text-xs mt-1">
                  Erst ein Stand – die Linien entstehen, sobald im nächsten Monat der zweite dazukommt.
                </p>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

// Auswahl der Sets für den Verlauf (Justus 11.11.2026: "alle an-/abwählen, übersichtlicher, ggf. Dropdown"):
// statt 100+ Knöpfen ein Aufklapp-Fenster mit Suche, "Alle auswählen/abwählen" und den Sets nach Serie gruppiert
// (Klick auf die Serie wählt sie ganz). Darunter stehen die ausgewählten Sets als Marken mit ihrer Linienfarbe.
// Sets ohne Preis für die gewählte Kennzahl sind ausgegraut.
function SetPicker({ series, selected, colorOf, onSetMany }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const hasData = (s) => s.points.length > 0;
  const selectable = series.filter(hasData);
  const chosen = selectable.filter((s) => selected.has(s.id));
  const q = query.trim().toLowerCase();
  const listed = series.filter((s) => !q || s.name.toLowerCase().includes(q) || (s.series ?? "").toLowerCase().includes(q));
  const listedIds = listed.filter(hasData).map((s) => s.id);
  const groups = [];
  for (const s of listed) {
    const key = s.series || "Weitere";
    let g = groups.find((x) => x.key === key);
    if (!g) groups.push((g = { key, items: [] }));
    g.items.push(s);
  }
  const linkCls = "text-xs text-subtle underline hover:text-ink disabled:opacity-40 disabled:no-underline";

  return (
    <div className="mb-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="relative" ref={ref}>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="flex items-center gap-2 border border-line rounded-full px-4 py-1.5 text-xs hover:border-ink"
          >
            Sets auswählen
            <span className="font-mono text-subtle">
              {chosen.length} von {selectable.length}
            </span>
            <span aria-hidden="true" className={`inline-block transition-transform ${open ? "rotate-180" : ""}`}>▾</span>
          </button>

          {open && (
            <div className="absolute left-0 z-20 mt-2 w-[min(22rem,calc(100vw-3rem))] bg-surface border border-line rounded-2xl shadow-lg">
              <div className="p-3 border-b border-line">
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Set oder Serie suchen"
                  autoFocus
                  className="w-full border border-line rounded-full px-3 py-1.5 text-xs bg-canvas text-ink focus:outline-none focus:border-ink"
                />
                <div className="flex items-center justify-between mt-2">
                  <button type="button" className={linkCls} disabled={!listedIds.length} onClick={() => onSetMany(listedIds, true)}>
                    {q ? "Treffer auswählen" : "Alle auswählen"}
                  </button>
                  <button type="button" className={linkCls} disabled={!listedIds.length} onClick={() => onSetMany(listedIds, false)}>
                    {q ? "Treffer abwählen" : "Alle abwählen"}
                  </button>
                </div>
              </div>
              <div className="max-h-72 overflow-y-auto py-1">
                {groups.length === 0 && <p className="text-xs text-subtle px-3 py-2">Kein Set gefunden.</p>}
                {groups.map((g) => {
                  const ids = g.items.filter(hasData).map((s) => s.id);
                  const allOn = ids.length > 0 && ids.every((id) => selected.has(id));
                  return (
                    <div key={g.key}>
                      <button
                        type="button"
                        disabled={!ids.length}
                        onClick={() => onSetMany(ids, !allOn)}
                        title={allOn ? "Ganze Serie abwählen" : "Ganze Serie auswählen"}
                        className="w-full flex items-center justify-between px-3 pt-2.5 pb-1 text-[11px] font-medium text-subtle hover:text-ink"
                      >
                        <span className="truncate">{g.key}</span>
                        <span className="shrink-0 ml-2 underline">{allOn ? "abwählen" : "alle"}</span>
                      </button>
                      {g.items.map((s) => {
                        const ok = hasData(s);
                        const on = ok && selected.has(s.id);
                        return (
                          <label
                            key={s.id}
                            title={ok ? "" : "Für diese Kennzahl ist bei diesem Set kein Preis hinterlegt"}
                            className={`flex items-center gap-2 px-3 py-1.5 text-xs ${ok ? "cursor-pointer hover:bg-canvas" : "opacity-40 cursor-not-allowed"}`}
                          >
                            <input
                              type="checkbox"
                              checked={on}
                              disabled={!ok}
                              onChange={() => onSetMany([s.id], !on)}
                              className="accent-[var(--yellow)] shrink-0"
                            />
                            <span
                              className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ background: on ? colorOf.get(s.id) : "transparent", border: `1.5px solid ${on ? colorOf.get(s.id) : "var(--subtle)"}` }}
                            />
                            <span className="truncate">{s.name}</span>
                          </label>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <button type="button" className={linkCls} disabled={chosen.length === selectable.length} onClick={() => onSetMany(selectable.map((s) => s.id), true)}>
          Alle auswählen
        </button>
        <button type="button" className={linkCls} disabled={chosen.length === 0} onClick={() => onSetMany(selectable.map((s) => s.id), false)}>
          Alle abwählen
        </button>
      </div>

      {chosen.length > 0 && chosen.length <= MAX_CHIPS && (
        <div className="flex flex-wrap gap-2 mt-3">
          {chosen.map((s) => (
            <span key={s.id} className="flex items-center gap-1.5 pl-3 pr-1.5 py-1 rounded-full text-xs border border-line bg-surface">
              <span className="inline-block w-2.5 h-2.5 rounded-full shrink-0" style={{ background: colorOf.get(s.id) }} />
              {s.name}
              <button
                type="button"
                onClick={() => onSetMany([s.id], false)}
                aria-label={`${s.name} abwählen`}
                className="w-5 h-5 rounded-full text-subtle hover:text-ink hover:bg-line leading-none"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      {chosen.length > MAX_CHIPS && (
        <p className="text-xs text-subtle mt-2">{chosen.length} Sets ausgewählt. Bei so vielen Linien hilft die Auswahl einzelner Serien.</p>
      )}
    </div>
  );
}

// Box-/Boosterpreise pflegen (nur Betreiber, keine freie API-Quelle). Zeigt
// zuerst die neuesten Sets; Boxpreis leer lassen bei Sets ohne Display.
function PriceEditor({ onSaved }) {
  const [sets, setSets] = useState(null);
  const [all, setAll] = useState(false);

  useEffect(() => {
    getSets().then(setSets).catch(() => setSets([]));
  }, []);

  if (sets === null) return <p className="text-subtle text-xs mb-4">Lade Sets …</p>;
  const list = all ? sets : sets.slice(0, 15);

  return (
    <div className="bg-surface border border-line rounded-2xl px-5 py-4 shadow-sm mb-6">
      <p className="text-sm font-medium mb-1">Preise pflegen</p>
      <p className="text-xs text-subtle mb-3">
        Die Preise kommen jede Nacht automatisch (grau im Feld). Ein eigener Wert geht vor; beide Felder
        leeren und speichern = wieder automatisch.
      </p>
      <div className="space-y-2">
        {list.map((s) => (
          <PriceRow key={s.id} set={s} onSaved={onSaved} />
        ))}
      </div>
      {!all && sets.length > list.length && (
        <button onClick={() => setAll(true)} className="text-xs text-subtle underline hover:text-ink mt-3">
          Alle {sets.length} Sets anzeigen
        </button>
      )}
    </div>
  );
}

function PriceRow({ set, onSaved }) {
  const toInput = (c) => (c != null ? (c / 100).toFixed(2) : "");
  // Eigene Werte nur zeigen, wenn sie gelten (alte Handwerte ohne Vorrang wären irreführend)
  const own = set.manual_prices_override;
  const [box, setBox] = useState(own ? toInput(set.box_price_cents) : "");
  const [booster, setBooster] = useState(own ? toInput(set.booster_price_cents) : "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await updateSetPrices(set.id, { boxEur: box.trim() || null, boosterEur: booster.trim() || null });
      setSaved(true);
      onSaved?.();
    } finally {
      setSaving(false);
    }
  }

  const input = "border border-line rounded-full px-2 py-1 text-xs bg-canvas w-24 focus:outline-none focus:border-ink";
  const edit = (setter) => (e) => {
    setSaved(false);
    setter(e.target.value);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs w-44 shrink-0 truncate" title={set.name}>
        {set.name}
      </span>
      <span className="text-xs text-subtle">Box</span>
      <input type="number" step="0.01" min="0" value={box} onChange={edit(setBox)} placeholder={toInput(set.auto_box_price_cents)} className={input} />
      <span className="text-xs text-subtle">Booster</span>
      <input type="number" step="0.01" min="0" value={booster} onChange={edit(setBooster)} placeholder={toInput(set.auto_booster_price_cents)} className={input} />
      <span className="text-xs text-subtle">€</span>
      <button
        onClick={save}
        disabled={saving}
        className="text-xs bg-yellow text-yellowInk px-3 py-1 rounded-full disabled:opacity-60"
      >
        {saving ? "…" : "Speichern"}
      </button>
      {saved && <span className="text-mint text-xs">✓</span>}
    </div>
  );
}
