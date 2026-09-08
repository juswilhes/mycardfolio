import { useState } from "react";
import { Link } from "react-router-dom";
import { deleteCollectionItem } from "../api.js";
import { variantLabel, langLabel } from "./CollectionItemDialog.jsx";

const eur = (n) => `${Number(n).toFixed(2)} €`;

// EIN Element der Sammlungsliste: Bild, Name/Set, rechts aktueller Wert
// plus (falls hinterlegt) Einstand und Gewinn/Verlust.
export default function CardTile({ item, onChanged }) {
  const price = item.latest_price;
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  const qty = item.quantity ?? 1;
  const hasCost = item.purchase_price != null || item.shipping_cost != null;
  const cost = hasCost ? ((item.purchase_price ?? 0) + (item.shipping_cost ?? 0)) * qty : null;
  const value = price ? price.price * qty : null;
  const gain = cost != null && value != null ? value - cost : null;

  async function remove(e) {
    e.preventDefault();
    e.stopPropagation();
    setBusy(true);
    try {
      await deleteCollectionItem(item.collection_item_id);
      onChanged?.();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Link
      to={`/card/${item.card_id}`}
      className="group flex items-center gap-4 py-4 border-b border-line"
    >
      <img
        src={item.image_small}
        alt={`${item.name} (Englisch)`}
        className="w-12 h-auto rounded shrink-0"
      />
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">
          {item.name}
          {langLabel(item.language) && (
            <span className="ml-2 align-middle text-[10px] font-semibold tracking-wide text-subtle border border-line rounded px-1 py-0.5">
              {langLabel(item.language)}
            </span>
          )}
        </p>
        <p className="text-subtle text-xs mt-0.5 truncate">
          {[item.rarity, item.set_name].filter(Boolean).join(" · ")} · {qty}×
          {item.variant && item.variant !== "normal" ? ` · ${variantLabel(item.variant)}` : ""}
        </p>
      </div>

      <div className="text-right shrink-0 tabular-nums">
        {price ? (
          <p className="font-mono font-medium">{eur(value)}</p>
        ) : (
          <p className="text-subtle text-sm">kein Preis</p>
        )}
        {cost != null && (
          <p className="text-xs mt-0.5">
            <span className="text-subtle">Einstand {eur(cost)}</span>
            {gain != null && (
              <span className={gain >= 0 ? "text-mint ml-2" : "text-rose ml-2"}>
                {gain >= 0 ? "+" : "−"}
                {eur(Math.abs(gain))}
                {cost > 0 && (
                  <> ({gain >= 0 ? "+" : "−"}{Math.abs((gain / cost) * 100).toFixed(1)} %)</>
                )}
              </span>
            )}
          </p>
        )}
      </div>

      {confirm ? (
        <span className="flex items-center gap-1 shrink-0">
          <button
            onClick={remove}
            disabled={busy}
            className="text-xs bg-rose text-white rounded-full px-2 py-1 disabled:opacity-60"
          >
            {busy ? "…" : "Entfernen"}
          </button>
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setConfirm(false); }}
            className="text-xs text-subtle px-1"
          >
            ✕
          </button>
        </span>
      ) : (
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setConfirm(true); }}
          aria-label="Aus Sammlung entfernen"
          className="shrink-0 w-7 h-7 rounded-full text-subtle opacity-50 group-hover:opacity-100 hover:bg-line hover:text-rose transition"
        >
          ✕
        </button>
      )}
    </Link>
  );
}
