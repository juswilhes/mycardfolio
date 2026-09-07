import { useCallback, useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
  getCollection,
  getPriceHistory,
  updateCollectionItem,
  deleteCollectionItem,
} from "../api.js";
import PriceChart from "../components/PriceChart.jsx";
import CollectionItemDialog from "../components/CollectionItemDialog.jsx";

// Route: /card/:cardId
// Holt sich (der Einfachheit halber) die ganze Sammlung und sucht sich
// den passenden Eintrag heraus, plus den Preisverlauf für den Graphen.
export default function CardDetail() {
  const { cardId } = useParams();
  const navigate = useNavigate();
  const [item, setItem] = useState(null);
  const [history, setHistory] = useState(null);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const loadItem = useCallback(
    () =>
      getCollection().then((items) => {
        setItem(items.find((i) => String(i.card_id) === cardId) ?? null);
      }),
    [cardId]
  );

  useEffect(() => {
    loadItem();
    getPriceHistory(cardId).then(setHistory);
  }, [cardId, loadItem]);

  if (item === null) {
    return <p className="text-subtle text-sm">Lade Kartendetails …</p>;
  }

  const prices = (history ?? []).map((h) => h.price);
  const min = prices.length ? Math.min(...prices) : null;
  const max = prices.length ? Math.max(...prices) : null;

  const qty = item.quantity ?? 1;
  const unitCost =
    item.purchase_price != null || item.shipping_cost != null
      ? (item.purchase_price ?? 0) + (item.shipping_cost ?? 0)
      : null;
  const totalCost = unitCost != null ? unitCost * qty : null;
  const currentValue = item.latest_price != null ? item.latest_price.price * qty : null;
  const gain =
    totalCost != null && currentValue != null ? currentValue - totalCost : null;
  const fmt = (n) => `${n.toFixed(2)} €`;

  async function saveEdit(values) {
    setBusy(true);
    try {
      await updateCollectionItem(item.collection_item_id, values);
      await loadItem();
      setEditing(false);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      await deleteCollectionItem(item.collection_item_id);
      navigate("/");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <Link to="/" className="text-sm text-subtle hover:text-ink">
        ← Zur Sammlung
      </Link>

      <div className="flex gap-5 mt-5 mb-6">
        <img
          src={item.image_large ?? item.image_small}
          alt={`${item.name} (Englisch)`}
          className="w-36 rounded-2xl"
        />
        <div>
          <h1 className="text-xl font-semibold">{item.name}</h1>
          <p className="text-subtle text-sm mt-1">{item.set_name} · #{item.number}</p>
          <p className="text-subtle text-sm">{item.rarity}</p>

          <div className="flex flex-wrap gap-2 mt-4">
            <button
              onClick={() => setEditing(true)}
              className="border border-line text-sm px-3 py-1.5 rounded-full hover:border-ink"
            >
              Bearbeiten
            </button>
            {confirmDelete ? (
              <>
                <button
                  onClick={remove}
                  disabled={busy}
                  className="bg-rose text-white text-sm px-3 py-1.5 rounded-full disabled:opacity-60"
                >
                  {busy ? "Entferne …" : "Wirklich entfernen"}
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="text-sm px-3 py-1.5 rounded-full text-subtle"
                >
                  Abbrechen
                </button>
              </>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                className="border border-line text-sm px-3 py-1.5 rounded-full text-rose hover:border-rose"
              >
                Aus Sammlung entfernen
              </button>
            )}
          </div>
        </div>
      </div>

      <p className="text-subtle text-sm mb-1">Aktueller Preis</p>
      <p className="text-3xl font-semibold font-mono mb-6">
        {item.latest_price ? `${item.latest_price.price.toFixed(2)} ${item.latest_price.currency}` : "—"}
      </p>

      <PriceChart data={history} />

      <div className="border-t border-line mt-6">
        <div className="flex justify-between py-3 border-b border-line text-sm">
          <span className="text-subtle">Menge in deiner Sammlung</span>
          <span>{qty}×</span>
        </div>
        <div className="flex justify-between py-3 border-b border-line text-sm">
          <span className="text-subtle">Zustand</span>
          <span>{item.condition}</span>
        </div>
        {item.purchase_price != null && (
          <div className="flex justify-between py-3 border-b border-line text-sm">
            <span className="text-subtle">Kaufpreis {qty > 1 ? "(pro Karte)" : ""}</span>
            <span className="font-mono">{fmt(item.purchase_price)}</span>
          </div>
        )}
        {item.shipping_cost != null && (
          <div className="flex justify-between py-3 border-b border-line text-sm">
            <span className="text-subtle">Versand {qty > 1 ? "(pro Karte)" : ""}</span>
            <span className="font-mono">{fmt(item.shipping_cost)}</span>
          </div>
        )}
        {totalCost != null && (
          <div className="flex justify-between py-3 border-b border-line text-sm">
            <span className="text-subtle">Einstandswert gesamt</span>
            <span className="font-mono">{fmt(totalCost)}</span>
          </div>
        )}
        {item.purchase_date && (
          <div className="flex justify-between py-3 border-b border-line text-sm">
            <span className="text-subtle">Kaufdatum</span>
            <span>{new Date(item.purchase_date).toLocaleDateString("de-DE")}</span>
          </div>
        )}
        {item.notes && (
          <div className="flex justify-between gap-6 py-3 border-b border-line text-sm">
            <span className="text-subtle shrink-0">Notiz</span>
            <span className="text-right">{item.notes}</span>
          </div>
        )}
        {gain != null && (
          <div className="flex justify-between py-3 border-b border-line text-sm">
            <span className="text-subtle">Wertentwicklung</span>
            <span className={`font-mono ${gain >= 0 ? "text-mint" : "text-rose"}`}>
              {gain >= 0 ? "+" : "−"}
              {fmt(Math.abs(gain))}
            </span>
          </div>
        )}
        <div className="flex justify-between py-3 border-b border-line text-sm">
          <span className="text-subtle">Preisquelle</span>
          <span>{item.latest_price?.source ?? "—"}</span>
        </div>
        {min !== null && (
          <div className="flex justify-between py-3 border-b border-line text-sm">
            <span className="text-subtle">Tiefstpreis im Verlauf</span>
            <span>{min.toFixed(2)}</span>
          </div>
        )}
        {max !== null && (
          <div className="flex justify-between py-3 border-b border-line text-sm">
            <span className="text-subtle">Höchstpreis im Verlauf</span>
            <span>{max.toFixed(2)}</span>
          </div>
        )}
      </div>

      {editing && (
        <CollectionItemDialog
          card={item}
          initial={item}
          title="Kauf bearbeiten"
          submitLabel="Speichern"
          busy={busy}
          onConfirm={saveEdit}
          onClose={() => !busy && setEditing(false)}
        />
      )}
    </div>
  );
}
