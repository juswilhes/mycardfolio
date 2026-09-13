import { useEffect, useState } from "react";

const today = () => new Date().toISOString().slice(0, 10);
const round2 = (n) => Math.round(n * 100) / 100;

// Dialog zum Erfassen ODER Bearbeiten eines Sealed-Produkts (Booster-Display,
// Elite Trainer Box, Bundle, ...). Anders als bei Karten gibt es dafür keine
// automatische Preisquelle - der aktuelle Wert wird vom Nutzer selbst
// eingetragen und bleibt bis zur nächsten manuellen Änderung stehen.
export default function SealedProductDialog({
  setName,
  initial,
  busy,
  error,
  onConfirm,
  onClose,
}) {
  const editing = !!initial;
  const [name, setName2] = useState(initial?.name ?? "");
  const [quantity, setQuantity] = useState(String(initial?.quantity ?? 1));
  // Gesamtpreis für diesen Kauf, wie beim Karten-Dialog - nicht pro Stück,
  // damit niemand selbst durch die Menge teilen muss.
  const [purchasePrice, setPurchasePrice] = useState(
    initial?.purchase_price != null ? String(round2(initial.purchase_price * (initial?.quantity ?? 1))) : ""
  );
  const [shippingCost, setShippingCost] = useState(
    initial?.shipping_cost != null ? String(round2(initial.shipping_cost * (initial?.quantity ?? 1))) : ""
  );
  const [purchaseDate, setPurchaseDate] = useState(
    initial?.purchase_date ? initial.purchase_date.slice(0, 10) : today()
  );
  const [currentValue, setCurrentValue] = useState(
    initial?.current_value != null ? String(initial.current_value) : ""
  );
  const [notes, setNotes] = useState(initial?.notes ?? "");

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const qty = parseInt(quantity, 10) || 1;
  const totalPaid = (parseFloat(purchasePrice) || 0) + (parseFloat(shippingCost) || 0);

  function submit(e) {
    e.preventDefault();
    if (busy || !name.trim()) return;
    onConfirm({
      name: name.trim(),
      quantity: qty,
      purchasePrice: purchasePrice === "" ? null : round2((parseFloat(purchasePrice) || 0) / qty),
      shippingCost: shippingCost === "" ? null : round2((parseFloat(shippingCost) || 0) / qty),
      purchaseDate: purchaseDate || null,
      currentValue: currentValue === "" ? null : parseFloat(currentValue) || 0,
      notes: notes.trim() || null,
    });
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
        className="w-full max-w-md max-h-[85vh] overflow-y-auto bg-surface border border-line rounded-3xl p-6 shadow-xl"
      >
        <p className="text-xs text-subtle mb-1">
          {editing ? "Sealed-Produkt bearbeiten" : "Sealed-Produkt hinzufügen"}
        </p>
        {setName && <p className="font-semibold mb-4 truncate">{setName}</p>}

        <div className="grid grid-cols-2 gap-3">
          <label className="text-xs text-subtle col-span-2">
            Name
            <input
              type="text" value={name} onChange={(e) => setName2(e.target.value)}
              placeholder="z. B. Elite Trainer Box"
              autoFocus
              className={inputCls}
            />
          </label>
          <label className="text-xs text-subtle">
            Menge
            <input
              type="number" min="1" value={quantity} onChange={(e) => setQuantity(e.target.value)}
              className={inputCls}
            />
          </label>
          <label className="text-xs text-subtle">
            Kaufdatum
            <input
              type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)}
              className={inputCls}
            />
          </label>
          <label className="text-xs text-subtle">
            Kaufpreis (€) gesamt
            <input
              type="number" min="0" step="0.01" inputMode="decimal" placeholder="0,00"
              value={purchasePrice} onChange={(e) => setPurchasePrice(e.target.value)}
              className={inputCls}
            />
            {qty > 1 && purchasePrice !== "" && (
              <span className="block mt-0.5 text-[11px] text-subtle">
                = {round2((parseFloat(purchasePrice) || 0) / qty).toFixed(2)} € / Stück
              </span>
            )}
          </label>
          <label className="text-xs text-subtle">
            Versand (€) gesamt
            <input
              type="number" min="0" step="0.01" inputMode="decimal" placeholder="0,00"
              value={shippingCost} onChange={(e) => setShippingCost(e.target.value)}
              className={inputCls}
            />
          </label>
          <label className="text-xs text-subtle col-span-2">
            Aktueller Wert (€) pro Stück
            <input
              type="number" min="0" step="0.01" inputMode="decimal" placeholder="optional"
              value={currentValue} onChange={(e) => setCurrentValue(e.target.value)}
              className={inputCls}
            />
            <span className="block mt-0.5 text-[11px] text-subtle">
              Gibt es dafür keine automatische Preisquelle - trag deine eigene Einschätzung ein, jederzeit änderbar.
            </span>
          </label>
          <label className="text-xs text-subtle col-span-2">
            Notiz (optional)
            <input
              type="text" value={notes} onChange={(e) => setNotes(e.target.value)}
              placeholder="z. B. gekauft bei …"
              className={inputCls}
            />
          </label>
        </div>

        <div className="flex items-center justify-between mt-5 mb-4 text-sm">
          <span className="text-subtle">Einstand gesamt</span>
          <span className="font-mono font-medium">{totalPaid.toFixed(2)} €</span>
        </div>

        {error && (
          <p className="text-rose text-sm mb-4 bg-rose/10 border border-rose/30 rounded-xl px-3 py-2">
            {error}
          </p>
        )}

        <div className="flex gap-2">
          <button
            type="button" onClick={onClose}
            className="flex-1 border border-line rounded-full py-2.5 text-sm hover:border-ink"
          >
            Abbrechen
          </button>
          <button
            type="submit" disabled={busy || !name.trim()}
            className="flex-1 bg-yellow text-yellowInk font-medium rounded-full py-2.5 text-sm disabled:opacity-60"
          >
            {busy ? "Speichern …" : editing ? "Speichern" : "Hinzufügen"}
          </button>
        </div>
      </form>
    </div>
  );
}
