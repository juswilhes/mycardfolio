import { useState } from "react";
import { searchCards, addToCollection } from "../api.js";
import { useNavigate, Link } from "react-router-dom";
import CollectionItemDialog from "../components/CollectionItemDialog.jsx";
import PortfolioAddedAnimation from "../components/PortfolioAddedAnimation.jsx";

export default function AddCard() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dialogCard, setDialogCard] = useState(null);
  const [celebrateCard, setCelebrateCard] = useState(null);
  const [busy, setBusy] = useState(false);
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

  async function confirmAdd(values) {
    setBusy(true);
    try {
      await addToCollection({ ...values, externalId: dialogCard.external_id });
      const card = dialogCard;
      setDialogCard(null);
      setCelebrateCard(card);
    } finally {
      setBusy(false);
    }
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
            <img
              src={card.image_large}
              alt={`${card.name} (Englisch)`}
              className="rounded-2xl mb-2 border border-line shadow-sm"
            />
            <p className="text-sm font-medium truncate">{card.name}</p>
            <p className="text-subtle text-xs truncate">{card.set_name}</p>
            <p className="text-subtle text-[11px] mb-2 truncate">
              {[card.rarity, card.artist && `✎ ${card.artist}`].filter(Boolean).join(" · ")}
            </p>
            <div className="mt-auto flex gap-2">
              <Link
                to={`/database/${card.external_id}`}
                className="flex-1 text-center border border-line text-xs py-1.5 rounded-full hover:border-ink"
              >
                Details
              </Link>
              <button
                onClick={() => setDialogCard(card)}
                className="flex-1 border border-line text-xs py-1.5 rounded-full hover:border-ink"
              >
                + Sammlung
              </button>
            </div>
          </div>
        ))}
      </div>

      {dialogCard && (
        <CollectionItemDialog
          card={dialogCard}
          busy={busy}
          onConfirm={confirmAdd}
          onClose={() => !busy && setDialogCard(null)}
        />
      )}
      {celebrateCard && (
        <PortfolioAddedAnimation card={celebrateCard} onDone={() => navigate("/")} />
      )}
    </div>
  );
}
