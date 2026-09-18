import { useEffect, useState } from "react";

// Dialog zum Einstellen einer Karte oder eines Sealed-Produkts im
// Marktplatz. Setzt ein eingerichtetes Verkäuferkonto voraus (prüft der
// Aufrufer/die API); hier nur Preis + optionale Beschreibung.
export default function SellListingDialog({ title, image, busy, error, onConfirm, onClose }) {
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function submit(e) {
    e.preventDefault();
    const p = parseFloat(price);
    if (busy || !p || p < 0.5) return;
    onConfirm({ priceEur: p, description: description.trim() || null });
  }

  const inputCls =
    "mt-1 w-full border border-line rounded-xl px-3 py-2 text-sm text-ink bg-canvas focus:outline-none focus:border-ink";

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-ink/40 backdrop-blur-sm"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <form
        onSubmit={submit}
        className="w-full max-w-sm bg-surface border border-line rounded-3xl p-6 shadow-xl"
      >
        <p className="text-xs text-subtle mb-1">Im Marktplatz anbieten</p>
        <div className="flex items-center gap-3 mb-4">
          {image && <img src={image} alt="" className="w-12 h-12 object-contain rounded-lg bg-canvas" />}
          <p className="font-semibold truncate">{title}</p>
        </div>

        <label className="text-xs text-subtle block">
          Preis (€)
          <input
            type="number" min="0.5" step="0.01" autoFocus
            value={price} onChange={(e) => setPrice(e.target.value)}
            placeholder="z. B. 25.00"
            className={inputCls}
          />
        </label>
        <label className="text-xs text-subtle block mt-3">
          Beschreibung (optional)
          <textarea
            value={description} onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className={inputCls}
          />
        </label>

        {error && <p className="text-rose text-sm mt-3">{error}</p>}

        <div className="flex gap-2 mt-5">
          <button
            type="submit"
            disabled={busy}
            className="flex-1 bg-yellow text-yellowInk font-medium py-2 rounded-full text-sm disabled:opacity-60"
          >
            {busy ? "…" : "Angebot einstellen"}
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="px-4 py-2 rounded-full text-sm text-subtle hover:text-ink"
          >
            Abbrechen
          </button>
        </div>
      </form>
    </div>
  );
}
