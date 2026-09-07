import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { getSet, getCardsForSet } from "../api.js";

// Route: /sets/:setId
// Zeigt Set-Kopfbereich (Logo, Name, Datum, Anzahl) und darunter ein
// Raster mit allen Karten des Sets - Klick führt zur Kartendetailseite.
export default function SetDetail() {
  const { setId } = useParams();
  const [set, setSet] = useState(null);
  const [cards, setCards] = useState(null);

  useEffect(() => {
    getSet(setId).then(setSet);
    getCardsForSet(setId).then(setCards);
  }, [setId]);

  return (
    <div>
      <Link to="/sets" className="text-sm text-subtle hover:text-ink">
        ← Alle Sets
      </Link>

      {set && (
        <div className="flex items-center gap-4 mt-4 mb-8">
          {set.logo && <img src={set.logo} alt={set.name} className="h-10 object-contain" />}
          <div>
            <h1 className="text-lg font-semibold">{set.name}</h1>
            <p className="text-subtle text-xs">
              {set.series} · {set.total} Karten
              {set.release_date ? ` · veröffentlicht ${set.release_date}` : ""}
            </p>
          </div>
        </div>
      )}

      {cards === null ? (
        <p className="text-subtle text-sm">Lade Karten …</p>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-4">
          {cards.map((card) => (
            <Link
              key={card.external_id}
              to={`/database/${card.external_id}`}
              className="flex flex-col"
            >
              <img
                src={card.image_small}
                alt={`${card.name} (Englisch)`}
                className="rounded-2xl border border-line mb-1.5 shadow-sm"
              />
              <p className="text-xs font-medium truncate">{card.name}</p>
              <p className="text-[11px] text-subtle">#{card.number}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
