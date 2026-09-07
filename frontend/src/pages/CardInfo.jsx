import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { getCardInfo, addToCollection } from "../api.js";

// Route: /database/:externalId
// Zeigt alle bekannten Infos zu EINER Karte, live von der Pokemon-TCG-API -
// funktioniert für jede Karte im Spiel, nicht nur für Karten, die man
// schon besitzt. Genau die Rolle, die bei Collectr/pokemonkarte.de die
// "Karten-Datenbank" hat, im Unterschied zur eigenen Portfolio-Ansicht.
export default function CardInfo() {
  const { externalId } = useParams();
  const [card, setCard] = useState(null);
  const [adding, setAdding] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    getCardInfo(externalId).then(setCard);
  }, [externalId]);

  async function handleAdd() {
    setAdding(true);
    try {
      await addToCollection({ externalId, quantity: 1 });
      navigate("/");
    } finally {
      setAdding(false);
    }
  }

  if (!card) {
    return <p className="text-subtle text-sm">Lade Kartendetails …</p>;
  }

  return (
    <div>
      <Link to={`/sets`} className="text-sm text-subtle hover:text-ink">
        ← Zur Kartendatenbank
      </Link>

      <div className="flex gap-6 mt-4 mb-7">
        <img
          src={card.image_large ?? card.image_small}
          alt={`${card.name} (Englisch)`}
          className="w-40 rounded-2xl"
        />
        <div>
          <h1 className="text-xl font-semibold">{card.name}</h1>
          <p className="text-subtle text-sm mt-1">{card.set_name} · #{card.number}</p>
          <p className="text-subtle text-sm">{card.rarity}</p>
          <button
            onClick={handleAdd}
            disabled={adding}
            className="mt-4 bg-yellow text-yellowInk font-medium px-4 py-2 rounded-full text-sm"
          >
            {adding ? "Wird hinzugefügt …" : "+ Zum Portfolio hinzufügen"}
          </button>
        </div>
      </div>

      <h2 className="text-sm text-subtle mb-2">Aktuelle Preise</h2>
      {card.prices.length === 0 ? (
        <p className="text-subtle text-sm">Für diese Karte liegen aktuell keine Preisdaten vor.</p>
      ) : (
        <div className="border-t border-line">
          {card.prices.map((p, i) => (
            <div key={i} className="flex justify-between py-3 border-b border-line text-sm">
              <span className="text-subtle">
                {p.source} · {p.price_type}
              </span>
              <span className="font-mono">
                {p.price.toFixed(2)} {p.currency}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
