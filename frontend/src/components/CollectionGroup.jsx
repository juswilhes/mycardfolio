import { useState } from "react";
import { Link } from "react-router-dom";
import CardTile from "./CardTile.jsx";

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
  const { entries } = group;

  if (entries.length === 1) {
    return <CardTile item={entries[0]} onChanged={onChanged} />;
  }

  const price = entries[0].latest_price?.price ?? null;
  const qty = entries.reduce((s, e) => s + (e.quantity ?? 1), 0);
  const value = price != null ? price * qty : null;

  const withCost = entries.filter((e) => entryCost(e) != null);
  const cost = withCost.reduce((s, e) => s + entryCost(e), 0);
  const pricedQty = withCost.reduce((s, e) => s + (e.quantity ?? 1), 0);
  const gain = withCost.length && price != null ? price * pricedQty - cost : null;

  return (
    <div className="border-b border-line">
      <div
        className="flex items-center gap-4 py-4 cursor-pointer"
        onClick={() => setOpen((o) => !o)}
      >
        <img src={group.image_small} alt="" className="w-12 h-auto rounded shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="font-medium truncate">{group.name}</p>
          <p className="text-subtle text-xs mt-0.5">
            {group.set_name} · {qty}× · {entries.length} Käufe
            <span className="ml-1">{open ? "▲" : "▼"}</span>
          </p>
        </div>
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
      </div>

      {open && (
        <div className="pb-3 pl-16 pr-1 space-y-1.5">
          {entries.map((e) => {
            const c = entryCost(e);
            const v = price != null ? price * (e.quantity ?? 1) : null;
            const g = c != null && v != null ? v - c : null;
            return (
              <div key={e.collection_item_id} className="flex justify-between gap-3 text-xs">
                <span className="text-subtle truncate">
                  {e.purchase_date
                    ? new Date(e.purchase_date).toLocaleDateString("de-DE")
                    : "Datum unbekannt"}
                  {(e.quantity ?? 1) > 1 ? ` · ${e.quantity}×` : ""}
                  {e.purchase_price != null ? ` · Kauf ${eur(e.purchase_price)}` : ""}
                  {c != null ? ` · Einstand ${eur(c)}` : ""}
                </span>
                {g != null && (
                  <span className={`font-mono shrink-0 ${g >= 0 ? "text-mint" : "text-rose"}`}>
                    {g >= 0 ? "+" : "−"}
                    {eur(Math.abs(g))}
                  </span>
                )}
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
