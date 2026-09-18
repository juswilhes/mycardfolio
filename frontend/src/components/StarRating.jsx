// Reine Anzeige (gerundete Sterne) für Verkäufer-Bewertungsschnitt.
export function StarRating({ rating, count }) {
  if (rating == null) return <span className="text-subtle text-xs">Noch keine Bewertungen</span>;
  const full = Math.round(rating);
  return (
    <span className="text-xs whitespace-nowrap">
      <span className="text-yellow">{"★".repeat(full)}</span>
      <span className="text-line">{"★".repeat(5 - full)}</span>{" "}
      <span className="text-subtle">
        {rating.toFixed(1)} ({count})
      </span>
    </span>
  );
}

// Interaktive Auswahl (1-5) für das Bewertungsformular.
export function StarPicker({ value, onChange }) {
  return (
    <div className="flex gap-1 text-2xl">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          className={n <= value ? "text-yellow" : "text-line hover:text-yellow/60"}
          aria-label={`${n} Sterne`}
        >
          ★
        </button>
      ))}
    </div>
  );
}
