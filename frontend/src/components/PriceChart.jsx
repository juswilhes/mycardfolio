import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

// Erwartet price_snapshots-Zeilen ({price, currency, fetched_at}) und
// zeichnet den Verlauf. Bewusst reduziert: kein Grid, keine Achsen-Linien,
// nur die gelbe Linie -> passt zum minimalistischen Finanz-App-Look.
export default function PriceChart({ data }) {
  if (!data || data.length === 0) {
    return (
      <p className="text-subtle text-sm py-6">
        Noch keine Preishistorie — der erste automatische Abruf legt den Startpunkt fest.
      </p>
    );
  }

  const chartData = data.map((d) => ({
    date: new Date(d.fetched_at).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" }),
    price: d.price,
    currency: d.currency,
  }));

  return (
    <ResponsiveContainer width="100%" height={140}>
      <LineChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <XAxis dataKey="date" stroke="#8a8a8a" fontSize={11} tickLine={false} axisLine={false} />
        <YAxis hide domain={["dataMin - 1", "dataMax + 1"]} />
        <Tooltip
          contentStyle={{
            background: "var(--surface)",
            border: "1px solid var(--line)",
            borderRadius: 6,
            fontSize: 12,
            color: "var(--ink)",
          }}
          labelStyle={{ color: "var(--subtle)" }}
          formatter={(value, _name, props) => [`${value} ${props.payload.currency}`, "Preis"]}
        />
        <Line type="monotone" dataKey="price" stroke="#f6e94d" strokeWidth={2.5} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
