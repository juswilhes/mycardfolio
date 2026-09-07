import { useEffect, useState } from "react";

export const CONDITIONS = [
  ["sealed", "Sealed"],
  ["mint", "Mint"],
  ["near_mint", "Near Mint"],
  ["excellent", "Excellent"],
  ["good", "Good"],
  ["light_played", "Light Played"],
  ["played", "Played"],
  ["poor", "Poor"],
];

// inkl. alter Werte, damit früher gespeicherte Einträge lesbar bleiben
const CONDITION_LABELS = {
  ...Object.fromEntries(CONDITIONS),
  lightly_played: "Light Played",
  moderately_played: "Played",
  heavily_played: "Played",
  damaged: "Poor",
};
export const conditionLabel = (v) => CONDITION_LABELS[v] ?? v ?? "—";

export const VARIANTS = [
  ["normal", "Normal"],
  ["holo", "Holo"],
  ["reverse", "Reverse Holo"],
  ["first_edition", "1st Edition"],
];
const VARIANT_LABELS = Object.fromEntries(VARIANTS);
export const variantLabel = (v) => VARIANT_LABELS[v] ?? "Normal";

const today = () => new Date().toISOString().slice(0, 10);

// Dialog zum Erfassen ODER Bearbeiten eines Sammlungs-Eintrags.
// onConfirm bekommt die reinen Formularwerte; der aufrufende Screen
// hängt ggf. externalId an und kümmert sich um API-Call + Animation.
export default function CollectionItemDialog({
  card,
  initial,
  title = "Zum Portfolio hinzufügen",
  submitLabel = "Zum Portfolio",
  busy,
  onConfirm,
  onClose,
}) {
  const [form, setForm] = useState({
    quantity: initial?.quantity ?? 1,
    condition: initial?.condition ?? "near_mint",
    variant: initial?.variant ?? "normal",
    language: initial?.language ?? "de",
    purchasePrice: initial?.purchase_price != null ? String(initial.purchase_price) : "",
    shippingCost: initial?.shipping_cost != null ? String(initial.shipping_cost) : "",
    purchaseDate: initial?.purchase_date ? initial.purchase_date.slice(0, 10) : today(),
    notes: initial?.notes ?? "",
  });

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const price = parseFloat(form.purchasePrice) || 0;
  const shipping = parseFloat(form.shippingCost) || 0;
  const qty = parseInt(form.quantity, 10) || 1;
  const total = (price + shipping) * qty;

  function submit(e) {
    e.preventDefault();
    if (busy) return;
    onConfirm({
      quantity: qty,
      condition: form.condition,
      variant: form.variant,
      language: form.language,
      purchasePrice: form.purchasePrice === "" ? null : price,
      shippingCost: form.shippingCost === "" ? null : shipping,
      purchaseDate: form.purchaseDate || null,
      notes: form.notes.trim() || null,
    });
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-ink/40 backdrop-blur-sm"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <form
        onSubmit={submit}
        className="w-full max-w-md bg-surface border border-line rounded-3xl p-6 shadow-xl"
      >
        <div className="flex gap-4 mb-5">
          <img
            src={card.image_small ?? card.image_large}
            alt=""
            className="w-16 rounded-lg border border-line shrink-0"
          />
          <div className="min-w-0">
            <p className="text-xs text-subtle">{title}</p>
            <p className="font-semibold truncate">{card.name}</p>
            <p className="text-subtle text-xs truncate">
              {card.set_name}
              {card.number ? ` · #${card.number}` : ""}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="text-xs text-subtle">
            Menge
            <input
              type="number" min="1" value={form.quantity} onChange={set("quantity")}
              className="mt-1 w-full border border-line rounded-xl px-3 py-2 text-sm text-ink bg-canvas focus:outline-none focus:border-ink"
            />
          </label>
          <label className="text-xs text-subtle">
            Zustand
            <select
              value={form.condition} onChange={set("condition")}
              className="mt-1 w-full border border-line rounded-xl px-3 py-2 text-sm text-ink bg-canvas focus:outline-none focus:border-ink"
            >
              {CONDITIONS.map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </label>
          <label className="text-xs text-subtle col-span-2">
            Variante
            <select
              value={form.variant} onChange={set("variant")}
              className="mt-1 w-full border border-line rounded-xl px-3 py-2 text-sm text-ink bg-canvas focus:outline-none focus:border-ink"
            >
              {VARIANTS.map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </label>
          <label className="text-xs text-subtle col-span-2">
            Sprache der Karte
            <select
              value={form.language} onChange={set("language")}
              className="mt-1 w-full border border-line rounded-xl px-3 py-2 text-sm text-ink bg-canvas focus:outline-none focus:border-ink"
            >
              <option value="de">Deutsch</option>
              <option value="en">Englisch</option>
            </select>
          </label>
          <label className="text-xs text-subtle">
            Kaufpreis (€)
            <input
              type="number" min="0" step="0.01" inputMode="decimal" placeholder="0,00"
              value={form.purchasePrice} onChange={set("purchasePrice")}
              className="mt-1 w-full border border-line rounded-xl px-3 py-2 text-sm text-ink bg-canvas focus:outline-none focus:border-ink"
            />
          </label>
          <label className="text-xs text-subtle">
            Versand (€)
            <input
              type="number" min="0" step="0.01" inputMode="decimal" placeholder="0,00"
              value={form.shippingCost} onChange={set("shippingCost")}
              className="mt-1 w-full border border-line rounded-xl px-3 py-2 text-sm text-ink bg-canvas focus:outline-none focus:border-ink"
            />
          </label>
          <label className="text-xs text-subtle col-span-2">
            Kaufdatum
            <input
              type="date" value={form.purchaseDate} onChange={set("purchaseDate")}
              className="mt-1 w-full border border-line rounded-xl px-3 py-2 text-sm text-ink bg-canvas focus:outline-none focus:border-ink"
            />
          </label>
          <label className="text-xs text-subtle col-span-2">
            Notiz (optional)
            <input
              type="text" value={form.notes} onChange={set("notes")}
              placeholder="z. B. gekauft bei …"
              className="mt-1 w-full border border-line rounded-xl px-3 py-2 text-sm text-ink bg-canvas focus:outline-none focus:border-ink"
            />
          </label>
        </div>

        <div className="flex items-center justify-between mt-5 mb-4 text-sm">
          <span className="text-subtle">Einstandswert gesamt</span>
          <span className="font-mono font-medium">{total.toFixed(2)} €</span>
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
            {busy ? "Speichern …" : submitLabel}
          </button>
        </div>
      </form>
    </div>
  );
}
