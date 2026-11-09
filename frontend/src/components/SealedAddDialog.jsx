import { useEffect, useMemo, useState } from "react";
import { addSealedProduct } from "../api.js";
import SealedProductDialog from "./SealedProductDialog.jsx";

// Sealed-Produkt direkt aus "Meine Sammlung" hinzufügen (Justus 09.11.2026): erst das Set wählen, dann wie
// auf der Set-Seite das Produkt aus dem Katalog (Bild + automatischer Wert) oder von Hand eintragen.
export default function SealedAddDialog({ sets, onAdded, onClose }) {
  const [set, setSet] = useState(undefined); // undefined = noch nicht gewählt, null = ohne Set
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (set !== undefined) return undefined;
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [set, onClose]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (sets ?? []).filter((s) => !q || s.name.toLowerCase().includes(q)).slice(0, 60);
  }, [sets, query]);

  async function confirm(values, meta) {
    setBusy(true);
    setError(null);
    try {
      await addSealedProduct({ ...values, setId: set?.id ?? null, setName: set?.name ?? null });
      onAdded({ name: values.name, image: meta?.image ?? null });
    } catch (err) {
      setError(err.message || "Speichern fehlgeschlagen. Bitte nochmal versuchen.");
    } finally {
      setBusy(false);
    }
  }

  if (set !== undefined) {
    return (
      <SealedProductDialog
        setId={set?.id}
        setName={set?.name}
        busy={busy}
        error={error}
        onConfirm={confirm}
        onClose={() => !busy && onClose()}
      />
    );
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-ink/40 backdrop-blur-sm"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-md max-h-[85vh] flex flex-col bg-surface border border-line rounded-3xl p-6 shadow-xl">
        <p className="text-xs text-subtle mb-1">Sealed-Produkt hinzufügen</p>
        <p className="font-semibold mb-3">Aus welchem Set?</p>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Set suchen, z. B. Prismatic Evolutions"
          autoFocus
          className="w-full border border-line rounded-xl px-3 py-2 text-sm text-ink bg-canvas focus:outline-none focus:border-ink mb-3"
        />
        <div className="overflow-y-auto -mx-2 flex-1">
          {sets === null ? (
            <p className="text-xs text-subtle px-2">Lade Sets …</p>
          ) : (
            shown.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setSet(s)}
                className="w-full flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-canvas text-left"
              >
                {s.logo ? (
                  <img src={s.logo} alt="" loading="lazy" className="h-6 w-14 object-contain shrink-0" />
                ) : (
                  <span className="w-14 shrink-0" />
                )}
                <span className="text-sm truncate flex-1">{s.name}</span>
                {s.release_date && <span className="text-[11px] text-subtle shrink-0">{s.release_date.slice(0, 4)}</span>}
              </button>
            ))
          )}
        </div>
        <div className="flex gap-2 mt-4">
          <button type="button" onClick={onClose} className="flex-1 border border-line rounded-full py-2.5 text-sm hover:border-ink">
            Abbrechen
          </button>
          <button type="button" onClick={() => setSet(null)} className="flex-1 border border-line rounded-full py-2.5 text-sm hover:border-ink">
            Ohne Set eintragen
          </button>
        </div>
      </div>
    </div>
  );
}
