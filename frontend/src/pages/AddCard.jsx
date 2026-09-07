import { useEffect, useRef, useState } from "react";
import { searchCards, addToCollection } from "../api.js";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import CollectionItemDialog from "../components/CollectionItemDialog.jsx";
import PortfolioAddedAnimation from "../components/PortfolioAddedAnimation.jsx";

export default function AddCard() {
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState(params.get("q") ?? "");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [dialogCard, setDialogCard] = useState(null);
  const [celebrateCard, setCelebrateCard] = useState(null);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const reqId = useRef(0);

  async function runSearch(q) {
    const term = q.trim();
    if (term.length < 2) {
      setResults([]);
      setSearched(false);
      return;
    }
    const id = ++reqId.current;
    setLoading(true);
    try {
      const res = await searchCards(term);
      if (id === reqId.current) {
        setResults(res);
        setSearched(true);
      }
    } finally {
      if (id === reqId.current) setLoading(false);
    }
  }

  // Suche während des Tippens (leicht verzögert)
  useEffect(() => {
    const t = setTimeout(() => {
      runSearch(query);
      setParams(query.trim() ? { q: query.trim() } : {}, { replace: true });
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

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
      <h1 className="text-xl font-semibold mb-1">Karte suchen</h1>
      <p className="text-subtle text-sm mb-5">
        Deutsche Namen gehen auch („Glurak", „Relaxo"), und du kannst die
        Kartennummer anhängen – z. B. „Mega Absol ex 180/132".
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          runSearch(query);
        }}
        className="flex gap-2 mb-8"
      >
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="z. B. Charizard, Glurak oder Mega Absol ex 180/132"
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
      {!loading && searched && results.length === 0 && (
        <p className="text-subtle text-sm">Keine Karte gefunden.</p>
      )}

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
