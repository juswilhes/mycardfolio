import { eur, formatDate } from "../lib/format.js";

// Booster- und Displaypreis eines Sets, oben auf der Set-Seite (Justus 29.10.2026; Berechnung siehe
// backend/src/services/sealedPrices.js). Nur die Zahlen, keine Erklärung der Berechnung (Justus: Fakten liefern).
export default function SealedPrices({ sealed }) {
  if (!sealed) return null;
  return (
    <div className="bg-surface border border-line rounded-2xl px-4 py-3 shadow-sm mb-6">
      <div className="flex items-baseline justify-between gap-3 flex-wrap mb-2">
        <p className="text-sm font-medium">Sealed</p>
        {sealed.updated && <p className="text-[11px] text-subtle">Stand {formatDate(sealed.updated)}</p>}
      </div>
      <div className="grid grid-cols-2 gap-2 max-w-lg">
        <SealedPrice label="Booster" item={sealed.booster} />
        <SealedPrice label="Display (36 Booster)" item={sealed.display} />
      </div>
      {!sealed.display && <p className="text-[11px] text-subtle mt-2">Dieses Set gibt es nicht als Display.</p>}
    </div>
  );
}

function SealedPrice({ label, item }) {
  if (!item) {
    return (
      <div className="rounded-xl bg-canvas border border-line px-3 py-2">
        <p className="text-[11px] text-subtle">{label}</p>
        <p className="text-sm text-subtle">—</p>
      </div>
    );
  }
  return (
    <a
      href={item.link}
      target="_blank"
      rel="noopener noreferrer"
      title={`${item.name} auf Cardmarket ansehen`}
      className="rounded-xl bg-canvas border border-line px-3 py-2 hover:border-ink flex items-center gap-3"
    >
      {item.image && (
        <img src={item.image} alt={item.name} loading="lazy" className="h-20 w-16 object-contain shrink-0 rounded" />
      )}
      <span className="min-w-0">
        <span className="block text-[11px] text-subtle">{label}</span>
        <span className="block text-base font-semibold font-mono">{eur(item.priceCents / 100)}</span>
      </span>
    </a>
  );
}
