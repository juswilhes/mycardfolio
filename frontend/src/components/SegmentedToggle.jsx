// Umschalter als Pillen-Gruppe, aktiver Eintrag gelb. Gemeinsam genutzt von
// "Alle Karten" (Sets / Preisbewegungen) und "Analyse" (Auswahl der
// Analysen), damit beide gleich aussehen und sich gleich verhalten. Bei
// vielen Einträgen auf schmalen Screens seitlich scrollbar statt umbrechend.
export default function SegmentedToggle({ options, value, onChange }) {
  return (
    <div className="max-w-full overflow-x-auto mb-6">
      <div className="inline-flex rounded-full border border-line p-0.5 text-sm whitespace-nowrap">
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={() => onChange(o.id)}
            className={`px-3 py-1.5 rounded-full ${
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
