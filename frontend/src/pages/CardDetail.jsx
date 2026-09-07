import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { getCollection, getPriceHistory } from "../api.js";
import PriceChart from "../components/PriceChart.jsx";

// Route: /card/:cardId
// Holt sich (der Einfachheit halber) die ganze Sammlung und sucht sich
// den passenden Eintrag heraus, plus den Preisverlauf für den Graphen.
export default function CardDetail() {
  const { cardId } = useParams();
  const [item, setItem] = useState(null);
  const [history, setHistory] = useState(null);

  useEffect(() => {
    getCollection().then((items) => {
      setItem(items.find((i) => String(i.card_id) === cardId) ?? null);
    });
    getPriceHistory(cardId).then(setHistory);
  }, [cardId]);

  if (item === null) {
    return <p className="text-subtle text-sm">Lade Kartendetails …</p>;
  }

  const prices = (history ?? []).map((h) => h.price);
  const min = prices.length ? Math.min(...prices) : null;
  const max = prices.length ? Math.max(...prices) : null;

  return (
    <div>
      <Link to="/" className="text-sm text-subtle hover:text-ink">
        ← Zur Sammlung
      </Link>

      <div className="flex gap-5 mt-5 mb-7">
        <img
          src={item.image_large ?? item.image_small}
          alt={`${item.name} (Englisch)`}
          className="w-36 rounded-2xl"
        />
        <div>
          <h1 className="text-xl font-semibold">{item.name}</h1>
          <p className="text-subtle text-sm mt-1">{item.set_name} · #{item.number}</p>
          <p className="text-subtle text-sm">{item.rarity}</p>
        </div>
      </div>

      <p className="text-subtle text-sm mb-1">Aktueller Preis</p>
      <p className="text-3xl font-semibold font-mono mb-6">
        {item.latest_price ? `${item.latest_price.price.toFixed(2)} ${item.latest_price.currency}` : "—"}
      </p>

      <PriceChart data={history} />

      <div className="border-t border-line mt-6">
        <div className="flex justify-between py-3 border-b border-line text-sm">
          <span className="text-subtle">Quelle</span>
          <span>{item.latest_price?.source ?? "—"}</span>
        </div>
        <div className="flex justify-between py-3 border-b border-line text-sm">
          <span className="text-subtle">Menge in deiner Sammlung</span>
          <span>{item.quantity}×</span>
        </div>
        <div className="flex justify-between py-3 border-b border-line text-sm">
          <span className="text-subtle">Zustand</span>
          <span>{item.condition}</span>
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
    </div>
  );
}
