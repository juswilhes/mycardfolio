import { useCallback, useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
  getCollection,
  getPriceHistory,
  updateCollectionItem,
  deleteCollectionItem,
  sellCollectionItem,
} from "../api.js";
import PriceSection from "../components/PriceSection.jsx";
import CollectionItemDialog, { conditionLabel } from "../components/CollectionItemDialog.jsx";
import SellDialog from "../components/SellDialog.jsx";

// Route: /card/:cardId
export default function CardDetail() {
  const { cardId } = useParams();
  const navigate = useNavigate();
  const [item, setItem] = useState(null);
  const [history, setHistory] = useState(null);
  const [editing, setEditing] = useState(false);
  const [selling, setSelling] = useState(false);
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

  async function sell(values) {
    setBusy(true);
    try {
      await sellCollectionItem(item.collection_item_id, values);
      navigate("/verkauft");
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
          <p className="text-subtle text-sm">
            {item.rarity}
            {item.language && (
              <span className="ml-2 text-xs border border-line rounded-full px-2 py-0.5">
                {item.language === "de" ? "Deutsch" : "Englisch"}
              </span>
            )}
          </p>

          <div className="flex flex-wrap gap-2 mt-4">
            <button
              onClick={() => setEditing(true)}
              className="border border-line text-sm px-3 py-1.5 rounded-full hover:border-ink"
            >
              Bearbeiten
            </button>
            <button
              onClick={() => setSelling(true)}
              className="border border-line text-sm px-3 py-1.5 rounded-full hover:border-ink"
            >
              Verkauft
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

      <PriceSection card={item} history={history} />

      <div className="border-t border-line mt-6">
        <div className="flex justify-between py-3 border-b border-line text-sm">
          <span className="text-subtle">Menge in deiner Sammlung</span>
          <span>{qty}×</span>
        </div>
        <div className="flex justify-between py-3 border-b border-line text-sm">
          <span className="text-subtle">Zustand</span>
          <span>{conditionLabel(item.condition)}</span>
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
      {selling && (
        <SellDialog
          item={item}
          busy={busy}
          onConfirm={sell}
          onClose={() => !busy && setSelling(false)}
        />
      )}
    </div>
  );
}
