import { useState } from "react";
import { searchCards, addToCollection } from "../api.js";
import { useNavigate } from "react-router-dom";

export default function AddCard() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleSearch(e) {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    try {
      setResults(await searchCards(query));
    } finally {
      setLoading(false);
    }
  }

  async function handleAdd(card) {
    await addToCollection({ externalId: card.external_id, quantity: 1 });
    navigate("/");
  }

  return (
    <div>
      <form onSubmit={handleSearch} className="flex gap-2 mb-8">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Kartenname, z.B. Charizard"
          className="flex-1 border border-line rounded-full px-4 py-2.5 text-sm placeholder:text-subtle focus:outline-none focus:border-ink"
        />
        <button
          className="bg-yellow text-yellowInk font-medium px-5 py-2.5 rounded-full text-sm"
          type="submit"
        >
          Suchen
        </button>
      </form>

      {loading && <p className="text-subtle text-sm">Suche läuft …</p>}

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {results.map((card) => (
          <div key={card.external_id} className="flex flex-col">
            {/* Bild kommt direkt von der API, siehe Erklärung in CardTile.jsx */}
            <img
              src={card.image_large}
              alt={`${card.name} (Englisch)`}
              className="rounded-2xl mb-2 border border-line shadow-sm"
            />
            <p className="text-sm font-medium truncate">{card.name}</p>
            <p className="text-subtle text-xs mb-2 truncate">{card.set_name}</p>
            <button
              onClick={() => handleAdd(card)}
              className="mt-auto border border-line text-sm py-1.5 rounded-full hover:border-ink"
            >
              + Zur Sammlung
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
