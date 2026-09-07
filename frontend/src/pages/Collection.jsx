import { useCallback, useEffect, useState } from "react";
import { getCollection } from "../api.js";
import CardTile from "../components/CardTile.jsx";
import { Link } from "react-router-dom";

export default function Collection() {
  const [items, setItems] = useState(null);

  const load = useCallback(
    () => getCollection().then(setItems).catch(() => setItems([])),
    []
  );

  useEffect(() => {
    load();
  }, [load]);

  if (items === null) {
    return <p className="text-subtle text-sm">Lade Sammlung …</p>;
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-24">
        <p className="text-lg font-medium mb-1">Noch keine Karten</p>
        <p className="text-subtle mb-6">Füge deine erste Karte hinzu, um den Wert zu verfolgen.</p>
        <Link
          to="/add"
          className="inline-block bg-yellow text-yellowInk font-medium px-5 py-2.5 rounded-full"
        >
          Karte hinzufügen
        </Link>
      </div>
    );
  }

  const totalValue = items.reduce((sum, i) => sum + (i.latest_price?.price ?? 0) * i.quantity, 0);
  const totalCards = items.reduce((sum, i) => sum + i.quantity, 0);

  // Einstand + Gewinn/Verlust nur über Karten, für die ein Kaufpreis hinterlegt ist.
  const withCost = items.filter((i) => i.purchase_price != null || i.shipping_cost != null);
  const totalCost = withCost.reduce(
    (s, i) => s + ((i.purchase_price ?? 0) + (i.shipping_cost ?? 0)) * i.quantity,
    0
  );
  const valueOfPriced = withCost.reduce(
    (s, i) => s + (i.latest_price?.price ?? 0) * i.quantity,
    0
  );
  const gain = valueOfPriced - totalCost;
  const eur = (n) => `${n.toFixed(2)} €`;

  return (
    <div>
      <div className="inline-flex flex-col gap-1 bg-surface border border-line rounded-2xl px-7 py-6 mb-8 shadow-sm">
        <p className="text-subtle text-sm">Gesamtwert deiner Sammlung</p>
        <p className="text-4xl font-semibold font-mono">{eur(totalValue)}</p>
        <span className="text-xs text-subtle mt-1">{totalCards} Karten im Portfolio</span>

        {withCost.length > 0 && (
          <div className="flex gap-5 mt-3 pt-3 border-t border-line text-sm">
            <div>
              <p className="text-subtle text-xs">Investiert</p>
              <p className="font-mono">{eur(totalCost)}</p>
            </div>
            <div>
              <p className="text-subtle text-xs">Gewinn / Verlust</p>
              <p className={`font-mono ${gain >= 0 ? "text-mint" : "text-rose"}`}>
                {gain >= 0 ? "+" : "−"}
                {eur(Math.abs(gain))}
                {totalCost > 0 && (
                  <span className="text-subtle">
                    {"  "}({gain >= 0 ? "+" : "−"}
                    {Math.abs((gain / totalCost) * 100).toFixed(1)} %)
                  </span>
                )}
              </p>
            </div>
          </div>
        )}
        {withCost.length > 0 && withCost.length < items.length && (
          <p className="text-[11px] text-subtle mt-2">
            G/V basiert auf {withCost.length} von {items.length} Karten mit hinterlegtem Kaufpreis.
          </p>
        )}
      </div>
      <div>
        {items.map((item) => (
          <CardTile key={item.collection_item_id} item={item} onChanged={load} />
        ))}
      </div>
    </div>
  );
}
