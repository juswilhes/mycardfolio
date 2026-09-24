import { Link } from "react-router-dom";
import { conditionLabel } from "./CollectionItemDialog.jsx";
import { StarRating } from "./StarRating.jsx";

const eur = (cents) => `${(cents / 100).toFixed(2)} €`;

// Alle aktuellen Marktplatz-Angebote GENAU dieser Karte (günstigstes zuerst),
// direkt auf der Kartenseite - man muss nicht extra im Marktplatz suchen.
// Ohne Angebote bleibt der Abschnitt unsichtbar. Die Angebote lädt die
// Kartenseite selbst (der Button oben braucht die Anzahl ebenfalls).
export default function CardMarketListings({ listings }) {
  if (!listings || listings.length === 0) return null;

  return (
    <section id="angebote" className="mt-10 scroll-mt-6">
      <h2 className="text-sm font-semibold mb-3">
        🛒 Im Marktplatz angeboten ({listings.length})
      </h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {listings.map((l) => (
          <Link
            key={l.id}
            to={`/marktplatz/angebot/${l.id}`}
            className="border border-line rounded-2xl p-3 flex flex-col hover:border-ink"
          >
            {(l.photo_url || l.image_url) && (
              <img
                src={l.photo_url || l.image_url}
                alt=""
                className="rounded-xl mb-2 object-contain h-32 bg-canvas"
              />
            )}
            <div className="flex items-center justify-between">
              <span className="font-mono font-medium">{eur(l.price_cents)}</span>
              {l.condition && <span className="text-xs text-subtle">{conditionLabel(l.condition)}</span>}
            </div>
            <div className="flex items-center justify-between mt-1 gap-2">
              <span className="text-xs text-subtle truncate">{l.seller_name || "mycardfolio-Nutzer"}</span>
              <StarRating rating={l.seller_rating} count={l.seller_review_count} />
            </div>
            {l.photo_url && <span className="text-[10px] text-subtle mt-1">📷 Foto vom Verkäufer</span>}
          </Link>
        ))}
      </div>
    </section>
  );
}
