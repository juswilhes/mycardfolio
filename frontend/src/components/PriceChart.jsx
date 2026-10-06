import { useState } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

const eur = (n) =>
  n.toLocaleString("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 2 });

const VARIANT_LABEL = { normal: "Normal", holo: "Holo", reverse: "Reverse Holo" };

// Erwartet Trend-Snapshots ({price, fetched_at, variant}) in EUR und
// zeichnet Normal plus die vorhandene Sonder-Variante (Holo ODER Reverse
// Holo) als eigene, farbige Linie - abwählbar über die Legende, standard-
// mäßig beide an. Mehr als diese zwei Reihen (z.B. getrennt für Reverse
// Holo UND Holo gleichzeitig, oder 1st Edition) liefert die kostenlose
// Quelle (Cardmarket über TCGdex) nicht - die hat strukturell nur zwei
// Preisfelder pro Karte, unabhängig davon, wie viele Druckvarianten es
// tatsächlich gibt.
export default function PriceChart({ data }) {
  const [hidden, setHidden] = useState(() => new Set());

  if (!data || data.length === 0) {
    return (
      <p className="text-subtle text-sm py-6">
        Noch keine Preishistorie — sie wächst ab jetzt täglich mit jedem
        automatischen Cardmarket-Abruf.
      </p>
    );
  }

  const byDate = new Map();
  let specialVariant = null;
  for (const d of data) {
    const variant = d.variant ?? "normal";
    if (variant !== "normal") specialVariant = variant;
    const day = d.fetched_at.slice(0, 10);
    if (!byDate.has(day)) {
      byDate.set(day, {
        date: new Date(d.fetched_at).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" }),
      });
    }
    byDate.get(day)[variant === "normal" ? "normal" : "special"] = d.price;
  }
  const chartData = [...byDate.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([, v]) => v);
  const hasSpecial = chartData.some((d) => d.special != null);
  const specialLabel = VARIANT_LABEL[specialVariant] ?? specialVariant;

  if (chartData.length < 2) {
    return (
      <p className="text-subtle text-sm py-4">
        Erst ein Datenpunkt ({eur(chartData[0].normal ?? chartData[0].special)}) — die
        Verlaufslinie entsteht über die nächsten Tage.
      </p>
    );
  }

  const toggle = (key) =>
    setHidden((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  const legendItems = [
    { key: "normal", label: "Normal", colorClass: "bg-yellow" },
    ...(hasSpecial ? [{ key: "special", label: specialLabel, colorClass: "bg-holo" }] : []),
  ];

  return (
    <div>
      <ResponsiveContainer width="100%" height={150}>
        <LineChart data={chartData} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
          <XAxis dataKey="date" stroke="var(--subtle)" fontSize={11} tickLine={false} axisLine={false} />
          <YAxis
            width={54}
            stroke="var(--subtle)"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            domain={["dataMin - 1", "dataMax + 1"]}
            tickFormatter={(v) => eur(v)}
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
            formatter={(value, name) => [eur(value), name === "special" ? specialLabel : "Normal"]}
          />
          {!hidden.has("normal") && (
            <Line type="monotone" dataKey="normal" name="normal" stroke="var(--yellow)" strokeWidth={2.5} dot={false} connectNulls />
          )}
          {hasSpecial && !hidden.has("special") && (
            <Line type="monotone" dataKey="special" name="special" stroke="var(--holo)" strokeWidth={2.5} dot={false} connectNulls />
          )}
        </LineChart>
      </ResponsiveContainer>
      {legendItems.length > 1 && (
        <div className="flex items-center gap-4 mt-1.5 text-xs">
          {legendItems.map(({ key, label, colorClass }) => (
            <button
              key={key}
              type="button"
              onClick={() => toggle(key)}
              className={`flex items-center gap-1.5 ${hidden.has(key) ? "text-subtle opacity-50" : "text-subtle"}`}
            >
              <span className={`inline-block w-2.5 h-2.5 rounded-full ${colorClass}`} />
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
