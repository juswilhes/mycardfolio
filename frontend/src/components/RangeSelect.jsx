import { RANGES } from "../lib/chartRange.js";

// Zeitraum-Umschalter für Graphen (7 Tage … 12 Monate). `options` schränkt
// die Auswahl ein, z. B. bei Monatsständen, wo 7 Tage keinen Sinn ergeben.
export default function RangeSelect({ value, onChange, options = RANGES }) {
  return (
    <div className="max-w-full overflow-x-auto">
      <div className="inline-flex rounded-full border border-line p-0.5 text-xs whitespace-nowrap">
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={() => onChange(o.id)}
            aria-pressed={value === o.id}
            className={`px-2.5 py-1 rounded-full ${
              value === o.id ? "bg-yellow text-yellowInk font-medium" : "text-subtle hover:text-ink"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
