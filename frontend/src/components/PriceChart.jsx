import { useState } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { eur } from "../lib/format.js";

const VARIANT_LABEL = { normal: "Normal", holo: "Holo", reverse: "Reverse Holo" };

// Letzter bekannter (nicht-leerer) Wert einer Spalte - für den Preis direkt
// im Legenden-Button.
function lastValue(chartData, key) {
  for (let i = chartData.length - 1; i >= 0; i--) {
    if (chartData[i][key] != null) return chartData[i][key];
  }
  return null;
}

// Erwartet die Preisreihe ({price, fetched_at, variant}) in EUR und
// zeichnet Normal plus die vorhandene Sonder-Variante (Holo ODER Reverse
// Holo) als eigene, farbige Linie. Die Legende steht OBEN, als farbige
// Buttons mit dem jeweils aktuellen Preis - Klick blendet die Linie aus/ein,
// standardmäßig sind alle an. Mehr als diese zwei Reihen (z.B. getrennt für
// Reverse Holo UND Holo gleichzeitig, oder 1st Edition) liefert die
// kostenlose Quelle (Cardmarket über TCGdex) nicht - die hat strukturell
// nur zwei Preisfelder pro Karte, unabhängig davon, wie viele Druck-
// varianten es tatsächlich gibt.
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

  // "Normal" ist nur dann eine sinnvolle Bezeichnung, wenn es tatsächlich
  // eine zweite Variante zum Abgrenzen gibt (z.B. Common mit Reverse Holo).
  // Bei Karten, die es nur in genau einer Ausführung gibt (Illustration
  // Rare, SIR, ...), gibt es kein "Normal" - dann zeigen wir gar keine
  // Legende, nur den Graphen.
  const legendItems = hasSpecial
    ? [
        { key: "normal", label: "Normal", price: lastValue(chartData, "normal"), bg: "bg-yellow", text: "text-yellowInk", border: "border-yellow" },
        { key: "special", label: specialLabel, price: lastValue(chartData, "special"), bg: "bg-holo", text: "text-white", border: "border-holo" },
      ]
    : [];

  // Mindestens eine Linie muss sichtbar bleiben - sonst könnte man den
  // Graphen komplett leer klicken.
  const toggle = (key) =>
    setHidden((prev) => {
      const isHidden = prev.has(key);
      if (!isHidden && legendItems.length - prev.size <= 1) return prev;
      const next = new Set(prev);
      isHidden ? next.delete(key) : next.add(key);
      return next;
    });

  const Legend = legendItems.length > 0 && (
    <div className="flex flex-wrap items-center gap-2 mb-2">
      {legendItems.map(({ key, label, price, bg, text, border }) => (
        <button
          key={key}
          type="button"
          onClick={() => toggle(key)}
          aria-pressed={!hidden.has(key)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition ${
            hidden.has(key) ? "border-line text-subtle bg-transparent" : `${border} ${bg} ${text}`
          }`}
        >
          {label}
          {price != null && <span className="font-mono">{eur(price)}</span>}
        </button>
      ))}
    </div>
  );

  if (chartData.length < 2) {
    return (
      <div>
        {Legend}
        <p className="text-subtle text-sm py-4">
          Erst ein Datenpunkt — die Verlaufslinie entsteht über die nächsten Tage.
        </p>
      </div>
    );
  }

  return (
    <div>
      {Legend}
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
    </div>
  );
}
