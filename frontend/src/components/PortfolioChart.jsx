import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from "recharts";

const eur = (n) =>
  Number(n).toLocaleString("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const eur2 = (n) =>
  Number(n).toLocaleString("de-DE", { style: "currency", currency: "EUR" });

// Wert der GESAMTEN Sammlung über die Zeit, plus (falls vorhanden) die
// investierte Summe als zweite Linie.
export default function PortfolioChart({ data }) {
  if (!data || data.length < 2) {
    return (
      <p className="text-subtle text-sm py-4">
        Der Verlauf entsteht ab jetzt – ein Punkt pro Tag. In ein paar Tagen
        siehst du hier, wie sich der Sammlungswert entwickelt.
      </p>
    );
  }

  const rows = data.map((d) => ({
    date: new Date(d.captured_on).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" }),
    Wert: d.total_value,
    Investiert: d.total_cost || null,
  }));
  const hasCost = rows.some((r) => r.Investiert != null);

  return (
    <ResponsiveContainer width="100%" height={180}>
      <LineChart data={rows} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
        <XAxis dataKey="date" stroke="var(--subtle)" fontSize={11} tickLine={false} axisLine={false} />
        <YAxis
          width={56}
          stroke="var(--subtle)"
          fontSize={11}
          tickLine={false}
          axisLine={false}
          domain={["dataMin - 5", "dataMax + 5"]}
          tickFormatter={eur}
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
          formatter={(v, name) => [eur2(v), name]}
        />
        {hasCost && <Legend wrapperStyle={{ fontSize: 11 }} />}
        <Line type="monotone" dataKey="Wert" stroke="var(--yellow)" strokeWidth={2.5} dot={false} />
        {hasCost && (
          <Line
            type="monotone"
            dataKey="Investiert"
            stroke="var(--subtle)"
            strokeWidth={1.5}
            strokeDasharray="4 4"
            dot={false}
          />
        )}
      </LineChart>
    </ResponsiveContainer>
  );
}
