import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

const eur = (n) =>
  n.toLocaleString("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 2 });

// Erwartet Trend-Snapshots ({price, fetched_at}) in EUR und zeichnet den
// Verlauf. Bewusst reduziert: nur die gelbe Linie.
export default function PriceChart({ data }) {
  if (!data || data.length === 0) {
    return (
      <p className="text-subtle text-sm py-6">
        Noch keine Preishistorie — sie wächst ab jetzt täglich mit jedem
        automatischen Cardmarket-Abruf.
      </p>
    );
  }

  const chartData = data.map((d) => ({
    date: new Date(d.fetched_at).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" }),
    price: d.price,
  }));

  if (chartData.length < 2) {
    return (
      <p className="text-subtle text-sm py-4">
        Erst ein Datenpunkt ({eur(chartData[0].price)}) — die Verlaufslinie
        entsteht über die nächsten Tage.
      </p>
    );
  }

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
            formatter={(value) => [eur(value), "Cardmarket Trend"]}
          />
          <Line type="monotone" dataKey="price" stroke="var(--yellow)" strokeWidth={2.5} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
