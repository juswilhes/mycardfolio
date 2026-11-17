import { useEffect, useState } from "react";
import { cardPath } from "../lib/paths.js";
import { Link } from "react-router-dom";
import { getWatchlist, removeFromWatchlist, getSealedWatchlist, removeSealedFromWatchlist } from "../api.js";
import { eur } from "../lib/format.js";

// Route: /watchlist – Karten und Sealed-Produkte (seit 17.11.2026), die man im Auge behält, ohne sie zu besitzen.
// Herzchen setzt man auf der Kartensuche, den Set-Seiten, der Kartenseite oder der Sealed-Produktseite; hier
// landet nur die Übersicht + aktueller Preis.
export default function Watchlist() {
  const [items, setItems] = useState(null);
  const [sealed, setSealed] = useState(null);

  function load() {
    getWatchlist().then(setItems).catch(() => setItems([]));
    getSealedWatchlist().then(setSealed).catch(() => setSealed([]));
  }

  useEffect(() => {
    load();
  }, []);

  async function remove(externalId) {
    setItems((prev) => prev.filter((i) => i.external_id !== externalId));
    try {
      await removeFromWatchlist(externalId);
    } catch {
      load();
    }
  }

  async function removeSealed(catalogId) {
    setSealed((prev) => prev.filter((i) => i.catalog_id !== catalogId));
    try {
      await removeSealedFromWatchlist(catalogId);
    } catch {
      load();
    }
  }

  if (items === null || sealed === null) return <p className="text-subtle text-sm">Lade Watchlist …</p>;

  const heart = (onClick) => (
    <button
      onClick={onClick}
      className="text-rose text-lg leading-none hover:opacity-70"
      aria-label="Von der Watchlist entfernen"
      title="Von der Watchlist entfernen"
    >
      ♥
    </button>
  );

  return (
    <div>
      <Link to="/sammlung" className="text-sm text-subtle hover:text-ink">← Meine Sammlung</Link>
      <h1 className="text-xl font-semibold mt-4 mb-1">Watchlist</h1>
      <p className="text-subtle text-sm mb-6">
        Karten und Sealed-Produkte, die du im Auge behältst, ohne sie schon in deiner Sammlung zu haben. Herzchen auf
        einer Karte oder einem Sealed-Produkt an- oder abklicken.
      </p>

      {items.length === 0 && sealed.length === 0 ? (
        <div className="text-center py-24">
          <p className="text-lg font-medium mb-1">Noch nichts gemerkt</p>
          <p className="text-subtle mb-6">Klick auf das Herzchen bei einer Karte oder einem Sealed-Produkt, um es hier zu sammeln.</p>
          <Link to="/sets" className="inline-block bg-yellow text-yellowInk font-medium px-5 py-2.5 rounded-full">
            Karten durchsuchen
          </Link>
        </div>
      ) : (
        <>
          {sealed.length > 0 && (
            <section className="mb-10">
              <h2 className="text-sm font-medium mb-3">Sealed ({sealed.length})</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {sealed.map((p) => (
                  <div key={p.catalog_id} className="flex flex-col">
                    <Link to={`/sealed/${p.catalog_id}`} className="flex flex-col group">
                      <div className="aspect-square bg-surface border border-line rounded-2xl shadow-sm mb-2 flex items-center justify-center p-3 group-hover:border-ink transition">
                        {p.image && <img src={p.image} alt={p.name} loading="lazy" decoding="async" className="max-w-full max-h-full object-contain" />}
                      </div>
                      <p className="text-sm font-medium line-clamp-2">{p.name}</p>
                      {p.set_name && <p className="text-subtle text-xs truncate">{p.set_name}</p>}
                    </Link>
                    <div className="flex items-center justify-between mt-1">
                      <span className="font-mono text-sm">{p.price_cents != null ? eur(p.price_cents / 100) : "—"}</span>
                      {heart(() => removeSealed(p.catalog_id))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {items.length > 0 && (
            <section>
              {sealed.length > 0 && <h2 className="text-sm font-medium mb-3">Einzelkarten ({items.length})</h2>}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {items.map((card) => (
                  <div key={card.external_id} className="flex flex-col">
                    <Link to={cardPath(card)} className="flex flex-col group">
                      <img
                        src={card.image_large ?? card.image_small}
                        alt={`${card.name} (Englisch)`}
                        loading="lazy"
                        decoding="async"
                        width={245}
                        height={342}
                        className="w-full h-auto rounded-2xl mb-2 border border-line shadow-sm group-hover:border-ink transition"
                      />
                      <p className="text-sm font-medium truncate">{card.name}</p>
                      <p className="text-subtle text-xs truncate">{card.set_name}</p>
                    </Link>
                    <div className="flex items-center justify-between mt-1">
                      <span className="font-mono text-sm">
                        {card.latest_price?.price != null ? eur(card.latest_price.price) : "—"}
                      </span>
                      {heart(() => remove(card.external_id))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
