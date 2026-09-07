import { Link } from "react-router-dom";

// EIN Element der Sammlungsliste: Bild links, Name/Set in der Mitte,
// Preis rechts. Klick führt zur Detailseite dieser Karte (/card/:cardId).
export default function CardTile({ item }) {
  const price = item.latest_price;

  return (
    <Link to={`/card/${item.card_id}`} className="flex items-center gap-4 py-4 border-b border-line">
      {/*
        Das Bild kommt NICHT von unserem eigenen Server, sondern direkt
        von der Bild-URL der Pokemon-TCG-API. Der Browser lädt es beim
        Rendern selbst von dort — wir speichern nur den Link dazu.
      */}
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
    </Link>
  );
}
