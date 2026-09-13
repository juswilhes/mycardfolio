import { useEffect, useState } from "react";
import { getSealedProducts, updateSealedProduct, deleteSealedProduct } from "../api.js";
import SealedProductDialog from "./SealedProductDialog.jsx";

const eur = (n) => `${Number(n).toFixed(2)} €`;

const cost = (p) =>
  p.purchase_price != null || p.shipping_cost != null
    ? ((p.purchase_price ?? 0) + (p.shipping_cost ?? 0)) * (p.quantity ?? 1)
    : null;
const value = (p) => (p.current_value != null ? p.current_value * (p.quantity ?? 1) : null);

// Versiegelte Produkte (Displays, Elite Trainer Boxen, ...) - eigener
// Abschnitt in der Sammlung, damit sie nicht in einem separaten Reiter
// untergehen. Lädt sich selbst nach, damit Collection.jsx davon nichts
// wissen muss.
export default function SealedProductList() {
  const [items, setItems] = useState(null);
  const [editItem, setEditItem] = useState(null);
  const [confirmId, setConfirmId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const load = () => getSealedProducts().then(setItems).catch(() => setItems([]));
  useEffect(load, []);

  async function saveEdit(values) {
    setBusy(true);
    setError(null);
    try {
      await updateSealedProduct(editItem.id, values);
      setEditItem(null);
      load();
    } catch (err) {
      setError(err.message || "Speichern fehlgeschlagen. Bitte nochmal versuchen.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id) {
    setBusy(true);
    try {
      await deleteSealedProduct(id);
      setConfirmId(null);
      load();
    } finally {
      setBusy(false);
    }
  }

  if (items === null) return null;

  const totalCost = items.reduce((s, p) => s + (cost(p) ?? 0), 0);
  const totalValue = items.reduce((s, p) => s + (value(p) ?? 0), 0);
  const anyValue = items.some((p) => p.current_value != null);

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-semibold">📦 Sealed Produkte</h2>
        {anyValue && (
          <p className="text-xs text-subtle">
            Wert {eur(totalValue)} · Einstand {eur(totalCost)}
          </p>
        )}
      </div>

      {items.length === 0 ? (
        <p className="text-subtle text-sm">
          Noch keine Sealed-Produkte. Auf der Seite eines Sets (unter „Alle Karten") gibt es
          den Button „📦 Sealed-Produkt hinzufügen".
        </p>
      ) : (
        <div className="border border-line rounded-2xl divide-y divide-line overflow-hidden">
          {items.map((p) => {
            const c = cost(p);
            const v = value(p);
            const gain = c != null && v != null ? v - c : null;
            return (
              <div key={p.id} className="flex items-center gap-3 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">
                    {p.name}
                    {(p.quantity ?? 1) > 1 && (
                      <span className="text-subtle font-normal"> · {p.quantity}×</span>
                    )}
                  </p>
                  <p className="text-subtle text-xs truncate">
                    {p.set_name ?? "Kein Set"}
                    {p.purchase_date ? ` · ${new Date(p.purchase_date).toLocaleDateString("de-DE")}` : ""}
                  </p>
                </div>
                <div className="text-right shrink-0 tabular-nums text-sm">
                  {v != null ? (
                    <p className="font-mono font-medium">{eur(v)}</p>
                  ) : (
                    <p className="text-subtle text-xs">kein Wert eingetragen</p>
                  )}
                  {c != null && (
                    <p className="text-xs mt-0.5">
                      <span className="text-subtle">Einstand {eur(c)}</span>
                      {gain != null && (
                        <span className={gain >= 0 ? "text-mint ml-2" : "text-rose ml-2"}>
                          {gain >= 0 ? "+" : "−"}
                          {eur(Math.abs(gain))}
                        </span>
                      )}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => setEditItem(p)}
                  className="shrink-0 text-xs text-subtle underline hover:text-ink"
                >
                  Bearbeiten
                </button>
                {confirmId === p.id ? (
                  <span className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => remove(p.id)}
                      disabled={busy}
                      className="text-xs bg-rose text-white rounded-full px-2 py-1 disabled:opacity-60"
                    >
                      {busy ? "…" : "Entfernen"}
                    </button>
                    <button onClick={() => setConfirmId(null)} className="text-xs text-subtle px-1">
                      ✕
                    </button>
                  </span>
                ) : (
                  <button
                    onClick={() => setConfirmId(p.id)}
                    aria-label="Sealed-Produkt entfernen"
                    className="shrink-0 w-6 h-6 rounded-full text-subtle hover:bg-line hover:text-rose transition"
                  >
                    ✕
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {editItem && (
        <SealedProductDialog
          initial={editItem}
          setName={editItem.set_name}
          busy={busy}
          error={error}
          onConfirm={saveEdit}
          onClose={() => !busy && (setEditItem(null), setError(null))}
        />
      )}
    </div>
  );
}
