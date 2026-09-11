import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getWatchlist, removeFromWatchlist } from "../api.js";

const eur = (n) => `${Number(n).toFixed(2)} €`;

// Route: /watchlist – Karten, die man im Auge behält, ohne sie zu besitzen.
// Herzchen setzt man auf der Kartensuche, den Set-Seiten oder der
// Kartendetailseite; hier landet nur die Übersicht + aktueller Preis.
export default function Watchlist() {
  const [items, setItems] = useState(null);

  function load() {
    getWatchlist().then(setItems).catch(() => setItems([]));
  }

  useEffect(load, []);

  async function remove(externalId) {
    setItems((prev) => prev.filter((i) => i.external_id !== externalId));
    try {
      await removeFromWatchlist(externalId);
    } catch {
      load();
    }
  }

  if (items === null) return <p className="text-subtle text-sm">Lade Watchlist …</p>;

  return (
    <div>
      <h1 className="text-xl font-semibold mb-1">❤️ Watchlist</h1>
      <p className="text-subtle text-sm mb-6">
        Karten, die du im Auge behältst, ohne sie schon in deiner Sammlung zu haben. Herzchen auf der
        Kartensuche oder einer Kartenseite an- oder abklicken.
      </p>

      {items.length === 0 ? (
        <div className="text-center py-24">
          <p className="text-lg font-medium mb-1">Noch keine Karte gemerkt</p>
          <p className="text-subtle mb-6">
            Klick auf das Herzchen bei einer Karte, um sie hier zu sammeln.
          </p>
          <Link to="/sets" className="inline-block bg-yellow text-yellowInk font-medium px-5 py-2.5 rounded-full">
            Karten durchsuchen
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {items.map((card) => (
            <div key={card.external_id} className="flex flex-col">
              <Link to={`/database/${card.external_id}`} className="flex flex-col group">
                <img
                  src={card.image_large ?? card.image_small}
                  alt={`${card.name} (Englisch)`}
                  className="rounded-2xl mb-2 border border-line shadow-sm group-hover:border-ink transition"
                />
                <p className="text-sm font-medium truncate">{card.name}</p>
                <p className="text-subtle text-xs truncate">{card.set_name}</p>
              </Link>
              <div className="flex items-center justify-between mt-1">
                <span className="font-mono text-sm">
                  {card.latest_price?.price != null ? eur(card.latest_price.price) : "—"}
                </span>
                <button
                  onClick={() => remove(card.external_id)}
                  className="text-rose text-lg leading-none hover:opacity-70"
                  aria-label="Von der Watchlist entfernen"
                  title="Von der Watchlist entfernen"
                >
                  ♥
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
