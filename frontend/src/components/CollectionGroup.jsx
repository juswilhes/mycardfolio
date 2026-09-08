import { useState } from "react";
import { Link } from "react-router-dom";
import CardTile from "./CardTile.jsx";
import { langLabel, gradeLabel } from "./CollectionItemDialog.jsx";
import { deleteCollectionItem } from "../api.js";

const eur = (n) => `${Number(n).toFixed(2)} €`;

const entryCost = (e) =>
  e.purchase_price != null || e.shipping_cost != null
    ? ((e.purchase_price ?? 0) + (e.shipping_cost ?? 0)) * (e.quantity ?? 1)
    : null;

// Ein Karten-Block in der Sammlungsliste. Ein einzelner Kauf -> normale
// Zeile (CardTile). Mehrere Käufe derselben Karte -> zusammengefasst mit
// aufklappbarer Auflistung der einzelnen Käufe.
export default function CollectionGroup({ group, onChanged }) {
  const [open, setOpen] = useState(false);
  const [confirmId, setConfirmId] = useState(null);
  const [busy, setBusy] = useState(false);
  const { entries } = group;

  if (entries.length === 1) {
    return <CardTile item={entries[0]} onChanged={onChanged} />;
  }

  const price = entries[0].latest_price?.price ?? null;
  const qty = entries.reduce((s, e) => s + (e.quantity ?? 1), 0);
  const value = price != null ? price * qty : null;

  const langs = [...new Set(entries.map((e) => langLabel(e.language)).filter(Boolean))];
  const grades = [
    ...new Set(entries.map((e) => gradeLabel(e.grading_company, e.grade)).filter(Boolean)),
  ];

  const withCost = entries.filter((e) => entryCost(e) != null);
  const cost = withCost.reduce((s, e) => s + entryCost(e), 0);
  const pricedQty = withCost.reduce((s, e) => s + (e.quantity ?? 1), 0);
  const gain = withCost.length && price != null ? price * pricedQty - cost : null;

  async function removeEntry(id) {
    setBusy(true);
    try {
      await deleteCollectionItem(id);
      setConfirmId(null);
      onChanged?.();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="border-b border-line">
      <div className="flex items-center gap-4 py-4">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-4 flex-1 min-w-0 text-left"
        >
          <img src={group.image_small} alt="" className="w-12 h-auto rounded shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="font-medium truncate">
              {group.name}
              {langs.map((l) => (
                <span
                  key={l}
                  className="ml-1.5 align-middle text-[10px] font-semibold tracking-wide text-subtle border border-line rounded px-1 py-0.5"
                >
                  {l}
                </span>
              ))}
              {grades.map((g) => (
                <span
                  key={g}
                  className="ml-1.5 align-middle text-[10px] font-semibold tracking-wide text-yellowInk bg-yellow rounded px-1 py-0.5"
                >
                  {g}
                </span>
              ))}
            </p>
            <p className="text-subtle text-xs mt-0.5 truncate">
              {[group.rarity, group.set_name].filter(Boolean).join(" · ")} · {qty}× ·{" "}
              {entries.length} Käufe
            </p>
          </div>
        </button>

        <div className="text-right shrink-0 tabular-nums">
          {value != null ? (
            <p className="font-mono font-medium">{eur(value)}</p>
          ) : (
            <p className="text-subtle text-sm">kein Preis</p>
          )}
          {withCost.length > 0 && (
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

        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-label={open ? "Käufe einklappen" : "Käufe anzeigen"}
          className="shrink-0 w-7 h-7 rounded-full text-subtle hover:bg-line hover:text-ink transition text-xs"
        >
          {open ? "▲" : "▼"}
        </button>
      </div>

      {open && (
        <div className="pb-3 pl-16 pr-1 space-y-2">
          {entries.map((e) => {
            const c = entryCost(e);
            const v = price != null ? price * (e.quantity ?? 1) : null;
            const g = c != null && v != null ? v - c : null;
            return (
              <div key={e.collection_item_id} className="flex items-center justify-between gap-3 text-xs">
                <Link to={`/card/${group.card_id}`} className="text-subtle truncate hover:text-ink">
                  {e.purchase_date
                    ? new Date(e.purchase_date).toLocaleDateString("de-DE")
                    : "Datum unbekannt"}
                  {(e.quantity ?? 1) > 1 ? ` · ${e.quantity}×` : ""}
                  {langLabel(e.language) ? ` · ${langLabel(e.language)}` : ""}
                  {gradeLabel(e.grading_company, e.grade) ? ` · ${gradeLabel(e.grading_company, e.grade)}` : ""}
                  {e.purchase_price != null ? ` · Kauf ${eur(e.purchase_price)}` : ""}
                  {c != null ? ` · Einstand ${eur(c)}` : ""}
                </Link>
                <span className="flex items-center gap-2 shrink-0">
                  {g != null && (
                    <span className={`font-mono ${g >= 0 ? "text-mint" : "text-rose"}`}>
                      {g >= 0 ? "+" : "−"}
                      {eur(Math.abs(g))}
                    </span>
                  )}
                  {confirmId === e.collection_item_id ? (
                    <>
                      <button
                        onClick={() => removeEntry(e.collection_item_id)}
                        disabled={busy}
                        className="bg-rose text-white rounded-full px-2 py-0.5 disabled:opacity-60"
                      >
                        {busy ? "…" : "Entfernen"}
                      </button>
                      <button onClick={() => setConfirmId(null)} className="text-subtle px-1">
                        ✕
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => setConfirmId(e.collection_item_id)}
                      aria-label="Diesen Kauf entfernen"
                      className="w-5 h-5 rounded-full text-subtle hover:bg-line hover:text-rose transition"
                    >
                      ✕
                    </button>
                  )}
                </span>
              </div>
            );
          })}
          <Link
            to={`/card/${group.card_id}`}
            className="inline-block text-xs text-subtle underline hover:text-ink mt-1"
          >
            Käufe verwalten →
          </Link>
        </div>
      )}
    </div>
  );
}
