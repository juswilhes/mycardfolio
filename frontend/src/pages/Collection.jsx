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

  return (
    <div>
      <div className="inline-flex flex-col gap-1 bg-surface border border-line rounded-2xl px-7 py-6 mb-8 shadow-sm">
        <p className="text-subtle text-sm">Gesamtwert deiner Sammlung</p>
        <p className="text-4xl font-semibold font-mono">
          {totalValue.toFixed(2)} €
        </p>
        <span className="text-xs text-subtle mt-1">{totalCards} Karten im Portfolio</span>
      </div>
      <div>
        {items.map((item) => (
          <CardTile key={item.collection_item_id} item={item} onChanged={load} />
        ))}
      </div>
    </div>
  );
}
