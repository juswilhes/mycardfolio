import { useEffect, useState } from "react";

const today = () => new Date().toISOString().slice(0, 10);
const eur = (n) => `${Number(n).toFixed(2)} €`;

// Dialog für "Karte verkauft": Verkaufserlös erfassen, realisierten
// Gewinn/Verlust live anzeigen. onConfirm bekommt die Werte.
export default function SellDialog({ item, busy, onConfirm, onClose }) {
  const [form, setForm] = useState({
    salePrice: "",
    saleShipping: "",
    saleFees: "",
    soldOn: today(),
    notes: "",
  });

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const qty = item.quantity ?? 1;
  const cost = ((item.purchase_price ?? 0) + (item.shipping_cost ?? 0)) * qty;
  const proceeds =
    ((parseFloat(form.salePrice) || 0) +
      (parseFloat(form.saleShipping) || 0) -
      (parseFloat(form.saleFees) || 0)) *
    qty;
  const realized = proceeds - cost;
  const hasCost = item.purchase_price != null || item.shipping_cost != null;

  function submit(e) {
    e.preventDefault();
    if (busy) return;
    onConfirm({
      salePrice: form.salePrice === "" ? null : parseFloat(form.salePrice),
      saleShipping: form.saleShipping === "" ? null : parseFloat(form.saleShipping),
      saleFees: form.saleFees === "" ? null : parseFloat(form.saleFees),
      soldOn: form.soldOn || null,
      notes: form.notes.trim() || null,
    });
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-ink/40 backdrop-blur-sm"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <form onSubmit={submit} className="w-full max-w-md bg-surface border border-line rounded-3xl p-6 shadow-xl">
        <div className="flex gap-4 mb-5">
          <img src={item.image_small} alt="" className="w-16 rounded-lg border border-line shrink-0" />
          <div className="min-w-0">
            <p className="text-xs text-subtle">Karte verkauft</p>
            <p className="font-semibold truncate">{item.name}</p>
            <p className="text-subtle text-xs truncate">
              {item.set_name}
              {item.number ? ` · #${item.number}` : ""} · {qty}×
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="text-xs text-subtle">
            Verkaufspreis (€) {qty > 1 ? "pro Karte" : ""}
            <input
              type="number" min="0" step="0.01" inputMode="decimal" placeholder="0,00" autoFocus
              value={form.salePrice} onChange={set("salePrice")}
              className="mt-1 w-full border border-line rounded-xl px-3 py-2 text-sm text-ink bg-canvas focus:outline-none focus:border-ink"
            />
          </label>
          <label className="text-xs text-subtle">
            Versand erhalten (€)
            <input
              type="number" min="0" step="0.01" inputMode="decimal" placeholder="0,00"
              value={form.saleShipping} onChange={set("saleShipping")}
              className="mt-1 w-full border border-line rounded-xl px-3 py-2 text-sm text-ink bg-canvas focus:outline-none focus:border-ink"
            />
          </label>
          <label className="text-xs text-subtle">
            Gebühren (€)
            <input
              type="number" min="0" step="0.01" inputMode="decimal" placeholder="0,00"
              value={form.saleFees} onChange={set("saleFees")}
              className="mt-1 w-full border border-line rounded-xl px-3 py-2 text-sm text-ink bg-canvas focus:outline-none focus:border-ink"
            />
          </label>
          <label className="text-xs text-subtle">
            Verkaufsdatum
            <input
              type="date" value={form.soldOn} onChange={set("soldOn")}
              className="mt-1 w-full border border-line rounded-xl px-3 py-2 text-sm text-ink bg-canvas focus:outline-none focus:border-ink"
            />
          </label>
          <label className="text-xs text-subtle col-span-2">
            Notiz (optional)
            <input
              type="text" value={form.notes} onChange={set("notes")}
              placeholder="z. B. verkauft an …"
              className="mt-1 w-full border border-line rounded-xl px-3 py-2 text-sm text-ink bg-canvas focus:outline-none focus:border-ink"
            />
          </label>
        </div>

        <div className="mt-5 mb-4 text-sm space-y-1">
          {hasCost && (
            <div className="flex justify-between text-subtle">
              <span>Einstandswert</span>
              <span className="font-mono">{eur(cost)}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-subtle">Erlös (nach Gebühren)</span>
            <span className="font-mono">{eur(proceeds)}</span>
          </div>
          {hasCost && (
            <div className="flex justify-between font-medium">
              <span>Realisiert</span>
              <span className={`font-mono ${realized >= 0 ? "text-mint" : "text-rose"}`}>
                {realized >= 0 ? "+" : "−"}
                {eur(Math.abs(realized))}
              </span>
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <button
            type="button" onClick={onClose}
            className="flex-1 border border-line rounded-full py-2.5 text-sm hover:border-ink"
          >
            Abbrechen
          </button>
          <button
            type="submit" disabled={busy}
            className="flex-1 bg-yellow text-yellowInk font-medium rounded-full py-2.5 text-sm disabled:opacity-60"
          >
            {busy ? "Speichern …" : "Verkauf eintragen"}
          </button>
        </div>
      </form>
    </div>
  );
}
