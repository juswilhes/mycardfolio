import { useState } from "react";
import { eur, formatDate } from "../lib/format.js";
import { getSealedCatalog } from "../api.js";

// Booster- und Displaypreis eines Sets, oben auf der Set-Seite (Justus 29.10.2026; Berechnung siehe
// backend/src/services/sealedPrices.js). Nur die Zahlen, keine Erklärung der Berechnung (Justus: Fakten liefern).
// Darunter aufklappbar alle übrigen versiegelten Produkte des Sets (Justus 09.11.2026, Katalog aus
// sealedCatalog.js) - erst beim Aufklappen geladen.
// onAdd (nur angemeldet): "+" je Produkt öffnet den Dialog mit diesem Produkt vorausgewählt (Justus 09.11.2026)
export default function SealedPrices({ sealed, setId, setName, catalogCount = 0, onAdd }) {
  const [open, setOpen] = useState(false);
  const [catalog, setCatalog] = useState(null);
  if (!sealed && !catalogCount) return null;

  function toggle() {
    if (!open && catalog === null && setId) {
      getSealedCatalog(setId)
        .then(setCatalog)
        .catch(() => setCatalog([]));
    }
    setOpen(!open);
  }

  // "Delta Reign Elite Trainer Box" -> "Elite Trainer Box" (der Set-Name steht schon oben)
  const short = (n) => (setName && n.startsWith(`${setName} `) ? n.slice(setName.length + 1) : n);

  return (
    <div className="bg-surface border border-line rounded-2xl px-4 py-3 shadow-sm mb-6">
      <div className="flex items-baseline justify-between gap-3 flex-wrap mb-2">
        <p className="text-sm font-medium">Sealed</p>
        {sealed?.updated && <p className="text-[11px] text-subtle">Stand {formatDate(sealed.updated)}</p>}
      </div>
      <div className="grid grid-cols-2 gap-2 max-w-lg">
        <SealedPrice label="Booster" item={sealed?.booster} />
        <SealedPrice label="Display (36 Booster)" item={sealed?.display} />
      </div>
      {sealed && !sealed.display && <p className="text-[11px] text-subtle mt-2">Dieses Set gibt es nicht als Display.</p>}

      {catalogCount > 0 && (
        <>
          <button
            type="button"
            onClick={toggle}
            aria-expanded={open}
            className="mt-3 text-xs text-subtle hover:text-ink flex items-center gap-1"
          >
            <span className={`inline-block transition-transform ${open ? "rotate-90" : ""}`} aria-hidden="true">
              ›
            </span>
            {open ? "Weitere Produkte ausblenden" : `Alle Sealed-Produkte anzeigen (${catalogCount})`}
          </button>
          {open && (
            <div className="mt-2 border-t border-line">
              {catalog === null ? (
                <p className="text-xs text-subtle py-3">Lade Produkte …</p>
              ) : (
                catalog.map((item) => (
                  <div key={item.id} className="flex items-center gap-2 border-b border-line last:border-b-0">
                  <a
                    href={item.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={`${item.name} auf Cardmarket ansehen`}
                    className="flex-1 min-w-0 flex items-center gap-3 py-2 hover:bg-canvas rounded"
                  >
                    {item.image ? (
                      <img src={item.image} alt="" loading="lazy" className="h-12 w-10 object-contain shrink-0" />
                    ) : (
                      <span className="h-12 w-10 shrink-0" />
                    )}
                    <span className="flex-1 min-w-0 text-sm truncate">{short(item.name)}</span>
                    <span className="text-sm font-mono shrink-0">{item.priceCents != null ? eur(item.priceCents / 100) : "—"}</span>
                  </a>
                  {onAdd && (
                    <button
                      type="button"
                      onClick={() => onAdd(item)}
                      title="Zur Sammlung hinzufügen"
                      aria-label={`${item.name} zur Sammlung hinzufügen`}
                      className="shrink-0 w-8 h-8 rounded-full border border-line hover:border-ink bg-canvas text-base leading-none"
                    >
                      +
                    </button>
                  )}
                  </div>
                ))
              )}
            </div>
          )}
        </>
      )}
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
