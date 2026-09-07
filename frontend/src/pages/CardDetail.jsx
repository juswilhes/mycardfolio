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
import SaleCelebrationAnimation from "../components/SaleCelebrationAnimation.jsx";

const fmt = (n) => `${Number(n).toFixed(2)} €`;

const entryCost = (e) =>
  e.purchase_price != null || e.shipping_cost != null
    ? ((e.purchase_price ?? 0) + (e.shipping_cost ?? 0)) * (e.quantity ?? 1)
    : null;

// Route: /card/:cardId  – zeigt EINE Karte + alle deine Exemplare davon.
export default function CardDetail() {
  const { cardId } = useParams();
  const navigate = useNavigate();
  const [entries, setEntries] = useState(null);
  const [history, setHistory] = useState(null);
  const [editEntry, setEditEntry] = useState(null);
  const [sellEntry, setSellEntry] = useState(null);
  const [celebration, setCelebration] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(
    () =>
      getCollection().then((items) =>
        setEntries(items.filter((i) => String(i.card_id) === cardId))
      ),
    [cardId]
  );

  useEffect(() => {
    load();
    getPriceHistory(cardId).then(setHistory);
  }, [cardId, load]);

  if (entries === null) return <p className="text-subtle text-sm">Lade Kartendetails …</p>;

  if (entries.length === 0) {
    return (
      <div>
        <Link to="/" className="text-sm text-subtle hover:text-ink">← Zur Sammlung</Link>
        <p className="text-subtle text-sm mt-6">
          Diese Karte ist nicht (mehr) in deiner Sammlung.
        </p>
      </div>
    );
  }

  const card = entries[0];
  const price = card.latest_price?.price ?? null;

  const totalQty = entries.reduce((s, e) => s + (e.quantity ?? 1), 0);
  const withCost = entries.filter((e) => entryCost(e) != null);
  const totalCost = withCost.reduce((s, e) => s + entryCost(e), 0);
  const totalValue = price != null ? price * totalQty : null;
  const valueOfPriced =
    price != null ? price * withCost.reduce((s, e) => s + (e.quantity ?? 1), 0) : 0;
  const totalGain = withCost.length ? valueOfPriced - totalCost : null;

  async function withReload(fn, after) {
    setBusy(true);
    try {
      await fn();
      const items = await getCollection();
      const rest = items.filter((i) => String(i.card_id) === cardId);
      setEntries(rest);
      if (rest.length === 0) navigate(after ?? "/");
    } finally {
      setBusy(false);
    }
  }

  const saveEdit = (values) =>
    withReload(() => updateCollectionItem(editEntry.collection_item_id, values)).then(() =>
      setEditEntry(null)
    );

  async function sell(values) {
    setBusy(true);
    try {
      const e = sellEntry;
      await sellCollectionItem(e.collection_item_id, values);
      const q = e.quantity ?? 1;
      const c = ((e.purchase_price ?? 0) + (e.shipping_cost ?? 0)) * q;
      const proceeds =
        ((values.salePrice ?? 0) + (values.saleShipping ?? 0) - (values.saleFees ?? 0)) * q;
      const realized = proceeds - c;
      setSellEntry(null);
      setCelebration({ card, realized, cost: c, proceeds, big: c > 0 && realized / c > 0.5 });
    } finally {
      setBusy(false);
    }
  }

  const remove = (id) =>
    withReload(() => deleteCollectionItem(id)).then(() => setConfirmDeleteId(null));

  return (
    <div>
      <Link to="/" className="text-sm text-subtle hover:text-ink">← Zur Sammlung</Link>

      <div className="flex gap-5 mt-5 mb-6">
        <img
          src={card.image_large ?? card.image_small}
          alt={`${card.name} (Englisch)`}
          className="w-36 rounded-2xl"
        />
        <div>
          <h1 className="text-xl font-semibold">{card.name}</h1>
          <p className="text-subtle text-sm mt-1">{card.set_name} · #{card.number}</p>
          <p className="text-subtle text-sm">{card.rarity}</p>
        </div>
      </div>

      <PriceSection card={card} history={history} />

      {/* Zusammenfassung über alle Exemplare */}
      <div className="border-t border-line mt-6">
        <Row label="Exemplare in deiner Sammlung" value={`${totalQty}×`} />
        {totalCost > 0 && <Row label="Einstandswert gesamt" value={fmt(totalCost)} mono />}
        {totalValue != null && <Row label="Aktueller Wert gesamt" value={fmt(totalValue)} mono />}
        {totalGain != null && (
          <Row
            label="Wertentwicklung gesamt"
            value={
              <span className={totalGain >= 0 ? "text-mint" : "text-rose"}>
                {totalGain >= 0 ? "+" : "−"}
                {fmt(Math.abs(totalGain))}
                {totalCost > 0 && (
                  <span className="text-subtle">
                    {"  "}({totalGain >= 0 ? "+" : "−"}
                    {Math.abs((totalGain / totalCost) * 100).toFixed(1)} %)
                  </span>
                )}
              </span>
            }
            mono
          />
        )}
      </div>

      {/* Einzelne Käufe */}
      <h2 className="text-sm text-subtle mt-8 mb-3">
        {entries.length > 1 ? `Deine ${entries.length} Käufe` : "Dein Exemplar"}
      </h2>
      <div className="space-y-3">
        {entries.map((e) => {
          const c = entryCost(e);
          const v = price != null ? price * (e.quantity ?? 1) : null;
          const g = c != null && v != null ? v - c : null;
          return (
            <div key={e.collection_item_id} className="border border-line rounded-2xl p-4">
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="text-subtle">
                  {e.purchase_date
                    ? `Gekauft am ${new Date(e.purchase_date).toLocaleDateString("de-DE")}`
                    : "Kaufdatum unbekannt"}
                  {" · "}
                  {conditionLabel(e.condition)}
                  {" · "}
                  {e.language === "de" ? "Deutsch" : "Englisch"}
                  {(e.quantity ?? 1) > 1 ? ` · ${e.quantity}×` : ""}
                </span>
                {g != null && (
                  <span className={`font-mono ${g >= 0 ? "text-mint" : "text-rose"}`}>
                    {g >= 0 ? "+" : "−"}
                    {fmt(Math.abs(g))}
                    {c > 0 && ` (${g >= 0 ? "+" : "−"}${Math.abs((g / c) * 100).toFixed(1)} %)`}
                  </span>
                )}
              </div>

              <div className="flex flex-wrap gap-x-6 gap-y-1 mt-2 text-xs text-subtle">
                {e.purchase_price != null && <span>Kaufpreis {fmt(e.purchase_price)}</span>}
                {e.shipping_cost != null && <span>Versand {fmt(e.shipping_cost)}</span>}
                {c != null && <span>Einstand {fmt(c)}</span>}
                {v != null && <span>Wert {fmt(v)}</span>}
                {e.notes && <span>„{e.notes}"</span>}
              </div>

              <div className="flex flex-wrap gap-2 mt-3">
                <button
                  onClick={() => setEditEntry(e)}
                  className="border border-line text-xs px-3 py-1.5 rounded-full hover:border-ink"
                >
                  Bearbeiten
                </button>
                <button
                  onClick={() => setSellEntry(e)}
                  className="border border-line text-xs px-3 py-1.5 rounded-full hover:border-ink"
                >
                  Verkauft
                </button>
                {confirmDeleteId === e.collection_item_id ? (
                  <>
                    <button
                      onClick={() => remove(e.collection_item_id)}
                      disabled={busy}
                      className="bg-rose text-white text-xs px-3 py-1.5 rounded-full disabled:opacity-60"
                    >
                      {busy ? "…" : "Wirklich entfernen"}
                    </button>
                    <button
                      onClick={() => setConfirmDeleteId(null)}
                      className="text-xs px-3 py-1.5 rounded-full text-subtle"
                    >
                      Abbrechen
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setConfirmDeleteId(e.collection_item_id)}
                    className="border border-line text-xs px-3 py-1.5 rounded-full text-rose hover:border-rose"
                  >
                    Entfernen
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {editEntry && (
        <CollectionItemDialog
          card={card}
          initial={editEntry}
          title="Kauf bearbeiten"
          submitLabel="Speichern"
          busy={busy}
          onConfirm={saveEdit}
          onClose={() => !busy && setEditEntry(null)}
        />
      )}
      {sellEntry && (
        <SellDialog
          item={sellEntry}
          busy={busy}
          onConfirm={sell}
          onClose={() => !busy && setSellEntry(null)}
        />
      )}
      {celebration && (
        <SaleCelebrationAnimation {...celebration} onDone={() => navigate("/verkauft")} />
      )}
    </div>
  );
}

function Row({ label, value, mono }) {
  return (
    <div className="flex justify-between py-3 border-b border-line text-sm">
      <span className="text-subtle">{label}</span>
      <span className={mono ? "font-mono" : ""}>{value}</span>
    </div>
  );
}
