import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { searchCards, addToCollection, getSets, getSetProgress } from "../api.js";
import CollectionItemDialog from "../components/CollectionItemDialog.jsx";
import PortfolioAddedAnimation from "../components/PortfolioAddedAnimation.jsx";

// "Alle Karten": oben die Kartensuche (zum Hinzufügen), darunter – solange
// nichts gesucht wird – die Set-Übersicht mit Sammlungs-Fortschritt.
export default function AllCards() {
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState(params.get("q") ?? "");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const [sets, setSets] = useState(null);
  const [progress, setProgress] = useState({});

  const [dialogCard, setDialogCard] = useState(null);
  const [celebrateCard, setCelebrateCard] = useState(null);
  const [busy, setBusy] = useState(false);

  const navigate = useNavigate();
  const reqId = useRef(0);
  const isSearching = query.trim().length >= 2;

  useEffect(() => {
    getSets().then(setSets).catch(() => setSets([]));
    getSetProgress().then(setProgress).catch(() => setProgress({}));
  }, []);

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

  const bySeries = (sets ?? []).reduce((acc, set) => {
    (acc[set.series || "Weitere"] ??= []).push(set);
    return acc;
  }, {});

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-xl font-semibold">Alle Karten</h1>
        <Link to="/import" className="text-sm text-subtle hover:text-ink underline">
          Viele Karten? → Massen-Import
        </Link>
      </div>
      <p className="text-subtle text-sm mb-4">
        Karte suchen und zur Sammlung hinzufügen – deutsche Namen gehen auch
        („Glurak"), und du kannst die Kartennummer anhängen (z. B. „Mega Absol
        ex 180/132"). Ohne Suche siehst du unten alle Sets.
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          runSearch(query);
        }}
        className="flex gap-2 mb-8"
      >
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="z. B. Charizard, Glurak oder Mega Absol ex 180/132"
          className="flex-1 rounded-full px-4 py-2.5 text-sm border border-line bg-white text-[#241c15] placeholder:text-[#8a7a63] caret-[#241c15] focus:outline-none focus:border-ink"
        />
        <button
          className="bg-yellow text-yellowInk font-medium px-5 py-2.5 rounded-full text-sm"
          type="submit"
        >
          Suchen
        </button>
      </form>

      {isSearching ? (
        <>
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
        </>
      ) : sets === null ? (
        <p className="text-subtle text-sm">Lade Sets …</p>
      ) : (
        Object.entries(bySeries).map(([series, seriesSets]) => (
          <div key={series} className="mb-8">
            <h2 className="text-sm text-subtle mb-3">{series}</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {seriesSets.map((set) => {
                const owned = progress[set.id] ?? 0;
                const total = set.total || 0;
                const pct = total ? Math.min(100, (owned / total) * 100) : 0;
                return (
                  <Link
                    key={set.id}
                    to={`/sets/${set.id}`}
                    className="border border-line rounded-2xl p-4 flex flex-col items-start gap-2 hover:border-ink shadow-sm"
                  >
                    {set.logo ? (
                      <img src={set.logo} alt={set.name} className="h-8 object-contain" />
                    ) : (
                      <span className="font-medium text-sm">{set.name}</span>
                    )}
                    <div className="text-xs text-subtle">
                      {set.total} Karten
                      {set.release_date ? ` · ${set.release_date.slice(0, 4)}` : ""}
                    </div>
                    {owned > 0 && (
                      <div className="w-full mt-0.5">
                        <div className="h-1.5 rounded-full bg-line overflow-hidden">
                          <div className="h-full bg-yellow" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-[11px] text-subtle">
                          {owned} / {total} in deiner Sammlung
                        </span>
                      </div>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))
      )}

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
