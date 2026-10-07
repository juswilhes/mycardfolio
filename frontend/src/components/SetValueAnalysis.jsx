import { Fragment, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { getSetValueAnalysis, getSets, updateSetPrices } from "../api.js";
import { useAuth } from "../context/AuthContext.jsx";

const eur = (n) => `${Number(n).toFixed(2)} €`;

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

// Analyse "Display & Booster": lohnt sich der Kauf eines Displays/Boosters im
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
        {editing ? "Pflege schließen" : "✏️ Preise pflegen"}
      </button>
    </div>
  );

  return (
    <div className="mb-10">
      {editorToggle}
      {editing && <PriceEditor onSaved={load} />}

      <h2 className="text-sm font-medium mb-1">📦 Display &amp; Booster im Vergleich</h2>
      <p className="text-xs text-subtle mb-3">
        Wie viel sind die 20 teuersten Karten eines Sets wert – im Verhältnis zum Preis eines Displays
        bzw. eines einzelnen Boosters? Kartenwerte sind der 30-Tage-Schnitt. Sondersets ohne Display
        (z. B. 30th Celebration) haben nur einen Boosterpreis. Klick auf ein Set zeigt die 20 Karten.
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
                            <p className="text-xs text-subtle">💎 Die {s.topCards.length} teuersten Karten</p>
                            <Link to={`/sets/${s.id}`} className="text-xs text-subtle underline hover:text-ink">
                              zum Set →
                            </Link>
                          </div>
                          <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-7 gap-3">
                            {s.topCards.map((c) => (
                              <Link key={c.external_id} to={`/database/${c.external_id}`} className="flex flex-col">
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

// Verlauf der Monatsstände eines Sets. Der erste Stand entsteht beim ersten
// Aufruf nach dem Deploy bzw. sobald Preise eingetragen sind, danach
// automatisch am 1. jedes Monats.
function HistoryChart({ rows }) {
  const withHistory = rows.filter((s) => s.history.length > 0);
  const [setId, setSetId] = useState(null);
  const [metric, setMetric] = useState("booster");

  const current = withHistory.find((s) => s.id === setId) ?? withHistory[0];
  const m = METRICS[metric];

  const data = useMemo(() => {
    if (!current) return [];
    return current.history
      .map((h) => ({ month: monthLabel(h.month), value: m.value(h) }))
      .filter((d) => d.value != null);
  }, [current, m]);

  return (
    <div className="mt-10">
      <h2 className="text-sm font-medium mb-1">📈 Verlauf</h2>
      <p className="text-xs text-subtle mb-3">
        Jeweils der Stand zum Monatsersten – so siehst du, ob sich ein Set im Verhältnis zum Booster-/Boxpreis
        lohnender oder weniger lohnend entwickelt. Ab dem 1. jedes Monats kommt automatisch ein neuer Punkt dazu.
      </p>

      {withHistory.length === 0 ? (
        <p className="text-subtle text-sm">Noch kein Stand gespeichert.</p>
      ) : (
        <>
          <div className="flex flex-wrap gap-2 mb-3">
            <select
              value={current.id}
              onChange={(e) => setSetId(e.target.value)}
              className="border border-line rounded-full px-3 py-1.5 text-xs bg-canvas text-ink focus:outline-none focus:border-ink"
            >
              {withHistory.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <select
              value={metric}
              onChange={(e) => setMetric(e.target.value)}
              className="border border-line rounded-full px-3 py-1.5 text-xs bg-canvas text-ink focus:outline-none focus:border-ink"
            >
              {Object.entries(METRICS).map(([v, { label }]) => (
                <option key={v} value={v}>{label}</option>
              ))}
            </select>
          </div>

          {data.length === 0 ? (
            <p className="text-subtle text-sm">
              Für diese Auswahl liegt noch kein passender Preis vor (z. B. Boxpreis bei einem Set ohne Display).
            </p>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={data} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
                  <XAxis dataKey="month" stroke="var(--subtle)" fontSize={11} tickLine={false} axisLine={false} />
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
                    contentStyle={{
                      background: "var(--surface)",
                      border: "1px solid var(--line)",
                      borderRadius: 8,
                      fontSize: 12,
                      color: "var(--ink)",
                    }}
                    labelStyle={{ color: "var(--subtle)" }}
                    formatter={(v) => [m.format(v), m.label]}
                  />
                  <Line type="monotone" dataKey="value" stroke="var(--yellow)" strokeWidth={2.5} dot />
                </LineChart>
              </ResponsiveContainer>
              {data.length < 2 && (
                <p className="text-subtle text-xs mt-1">
                  Erst ein Stand – die Linie entsteht, sobald am nächsten Monatsersten der zweite dazukommt.
                </p>
              )}
            </>
          )}
        </>
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
      <p className="text-sm font-medium mb-1">✏️ Preise pflegen</p>
      <p className="text-xs text-subtle mb-3">Boxpreis leer lassen bei Sets ohne Display (z. B. 30th Celebration).</p>
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
  const [box, setBox] = useState(toInput(set.box_price_cents));
  const [booster, setBooster] = useState(toInput(set.booster_price_cents));
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
      <input type="number" step="0.01" min="0" value={box} onChange={edit(setBox)} className={input} />
      <span className="text-xs text-subtle">Booster</span>
      <input type="number" step="0.01" min="0" value={booster} onChange={edit(setBooster)} className={input} />
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
