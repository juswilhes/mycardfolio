import { useState } from "react";
import { Link } from "react-router-dom";
import { deleteCollectionItem } from "../api.js";

// EIN Element der Sammlungsliste: Bild links, Name/Set in der Mitte,
// Preis rechts. Klick führt zur Detailseite dieser Karte (/card/:cardId).
// Beim Hovern erscheint rechts ein ✕ zum schnellen Entfernen.
export default function CardTile({ item, onChanged }) {
  const price = item.latest_price;
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

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
        <p className="font-medium truncate">{item.name}</p>
        <p className="text-subtle text-xs mt-0.5">
          {item.set_name} · {item.quantity}×
        </p>
      </div>

      <div className="text-right shrink-0">
        {price ? (
          <p className="font-mono font-medium">
            {price.price.toFixed(2)} {price.currency}
          </p>
        ) : (
          <p className="text-subtle text-sm">kein Preis</p>
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
          className="shrink-0 w-7 h-7 rounded-full text-subtle opacity-30 group-hover:opacity-100 hover:bg-line hover:text-rose transition"
        >
          ✕
        </button>
      )}
    </Link>
  );
}
