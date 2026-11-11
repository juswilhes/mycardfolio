import { useId, useState } from "react";
import { ComposedChart, Area, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { glow, areaDefs, areaFill, safeId, endDot, tooltipStyle } from "../lib/chartFx.jsx";
import { eur0 as eur, eur as eur2 } from "../lib/format.js";
import RangeSelect from "./RangeSelect.jsx";
import { rangeDays, withinDays, highestFirst } from "../lib/chartRange.js";

// Wert der GESAMTEN Sammlung über die Zeit, plus (falls vorhanden) die
// investierte Summe als zweite Linie.
export default function PortfolioChart({ data }) {
  const gradId = safeId(useId());
  const [range, setRange] = useState("12m");
  if (!data || data.length < 2) {
    return (
      <p className="text-subtle text-sm py-4">
        Der Verlauf entsteht ab jetzt – ein Punkt pro Tag. In ein paar Tagen
        siehst du hier, wie sich der Sammlungswert entwickelt.
      </p>
    );
  }

  const days = rangeDays(range);
  const dateFormat = days > 90 ? { day: "2-digit", month: "2-digit", year: "2-digit" } : { day: "2-digit", month: "2-digit" };
  const rows = withinDays(data, days, (d) => d.captured_on).map((d) => ({
    date: new Date(d.captured_on).toLocaleDateString("de-DE", dateFormat),
    Wert: d.total_value,
    Investiert: d.total_cost || null,
  }));
  const hasCost = rows.some((r) => r.Investiert != null);

  return (
    <div>
      <div className="flex justify-end mb-2">
        <RangeSelect value={range} onChange={setRange} />
      </div>
      {rows.length < 2 ? (
        <p className="text-subtle text-sm py-4">Für diesen Zeitraum gibt es erst einen Datenpunkt.</p>
      ) : (
    <ResponsiveContainer width="100%" height={180}>
      <ComposedChart data={rows} margin={{ top: 10, right: 14, left: 4, bottom: 0 }}>
        {areaDefs(gradId, "var(--yellow)")}
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
          itemSorter={highestFirst}
          contentStyle={tooltipStyle}
          cursor={{ stroke: "var(--subtle)", strokeDasharray: "3 4", strokeOpacity: 0.6 }}
          labelStyle={{ color: "var(--subtle)" }}
          formatter={(v, name) => [eur2(v), name]}
        />
        {hasCost && <Legend wrapperStyle={{ fontSize: 11 }} />}
        <Area
          type="monotone"
          dataKey="Wert"
          stroke="var(--yellow)"
          strokeWidth={2.5}
          fill={areaFill(gradId)}
          fillOpacity={1}
          style={glow("var(--yellow)")}
          dot={endDot("var(--yellow)", rows.length - 1)}
          activeDot={{ r: 4, stroke: "var(--canvas)", strokeWidth: 2 }}
        />
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
      </ComposedChart>
    </ResponsiveContainer>
      )}
    </div>
  );
}
