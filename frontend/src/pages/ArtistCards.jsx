import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { getCardsByArtist } from "../api.js";

// Route: /illustrator/:name – alle Karten eines Illustrators, verlinkt von
// der Illustrator-Zeile auf der Kartenseite. Frei zugänglich wie die Suche.
export default function ArtistCards() {
  const { name } = useParams();
  const artist = decodeURIComponent(name);
  const [cards, setCards] = useState(null);

  useEffect(() => {
    setCards(null);
    getCardsByArtist(artist)
      .then(setCards)
      .catch(() => setCards([]));
  }, [artist]);

  return (
    <div>
      <Link to="/sets" className="text-sm text-subtle hover:text-ink">← Alle Karten</Link>
      <h1 className="text-xl font-semibold mt-4 mb-1">🖌️ {artist}</h1>
      <p className="text-subtle text-sm mb-6">
        {cards === null ? "Lade Karten …" : `${cards.length} Karte${cards.length === 1 ? "" : "n"} von diesem Illustrator.`}
      </p>

      {cards === null ? null : cards.length === 0 ? (
        <p className="text-subtle text-sm">Keine Karten gefunden.</p>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-4">
          {cards.map((card) => (
            <Link key={card.external_id} to={`/database/${card.external_id}`} className="flex flex-col">
              <img
                src={card.image_small}
                alt={`${card.name} (Englisch)`}
                className="rounded-2xl border border-line mb-1.5 shadow-sm hover:border-ink transition"
              />
              <p className="text-xs font-medium truncate">{card.name}</p>
              <p className="text-[11px] text-subtle truncate">
                {card.set_name} · #{card.number}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
