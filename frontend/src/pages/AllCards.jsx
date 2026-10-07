import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { searchCards, addToCollection, getSets, getSetProgress, getWatchlistIds, getMarketMovers } from "../api.js";
import { useAuth } from "../context/AuthContext.jsx";
import CollectionItemDialog from "../components/CollectionItemDialog.jsx";
import PortfolioAddedAnimation from "../components/PortfolioAddedAnimation.jsx";
import WatchlistHeart from "../components/WatchlistHeart.jsx";
import SegmentedToggle from "../components/SegmentedToggle.jsx";

// "Alle Karten": oben die Kartensuche – funktioniert auch ohne Konto.
// Darunter, solange nichts gesucht wird, die Set-Übersicht. Zur Sammlung
// hinzufügen geht nur angemeldet.
export default function AllCards() {
  const { user, registrationOpen } = useAuth();
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState(params.get("q") ?? "");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const [sets, setSets] = useState(null);
  const [progress, setProgress] = useState({});
  const [watchedIds, setWatchedIds] = useState(new Set());

  // "sets" = Set-Übersicht (Standard), "movers" = größte Preisbewegungen -
  // Umschalter unter dem Suchfeld, siehe Toggle-Buttons unten.
  const [view, setView] = useState("sets");
  const [movers, setMovers] = useState(null);
  const [moversLoading, setMoversLoading] = useState(false);

  const [dialogCard, setDialogCard] = useState(null);
  const [celebrateCard, setCelebrateCard] = useState(null);
  const [busy, setBusy] = useState(false);
  const [addError, setAddError] = useState(null);

  const navigate = useNavigate();
  const reqId = useRef(0);
  const isSearching = query.trim().length >= 2;

  useEffect(() => {
    getSets().then(setSets).catch(() => setSets([]));
    getSetProgress().then(setProgress).catch(() => setProgress({}));
  }, []);

  useEffect(() => {
    if (!user) return setWatchedIds(new Set());
    getWatchlistIds().then((ids) => setWatchedIds(new Set(ids))).catch(() => {});
  }, [user]);

  // Lädt erst beim ersten Umschalten auf "Preisbewegungen" (nicht beim
  // Seitenaufbau), danach bleibt das Ergebnis für die Session im State.
  useEffect(() => {
    if (view !== "movers" || movers) return;
    setMoversLoading(true);
    getMarketMovers(30)
      .then(setMovers)
      .catch(() => setMovers({ gainers: [], losers: [], trackedCount: 0 }))
      .finally(() => setMoversLoading(false));
  }, [view, movers]);

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

  async function confirmAdd({ lots, ...shared }) {
    setBusy(true);
    setAddError(null);
    let done = 0;
    try {
      for (const lot of lots) {
        await addToCollection({ ...shared, ...lot, externalId: dialogCard.external_id });
        done++;
      }
      const card = dialogCard;
      setDialogCard(null);
      setCelebrateCard(card);
    } catch (err) {
      setAddError(
        `${err.message || "Speichern fehlgeschlagen"}${
          lots.length > 1 ? ` (${done}/${lots.length} Käufe bereits gespeichert)` : ""
        }`
      );
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
        Karte suchen – ganz ohne Konto. Deutsche Namen gehen auch („Glurak"),
        und du kannst die Kartennummer anhängen (z. B. „Mega Absol ex
        180/132"). Ohne Suche siehst du unten alle Sets.
        {!user && " Zum Hinzufügen zu einer Sammlung meldest du dich an."}
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

      {!isSearching && (
        <SegmentedToggle
          options={[
            { id: "sets", label: "Alle Sets" },
            { id: "movers", label: "📈 Preisbewegungen" },
          ]}
          value={view}
          onChange={setView}
        />
      )}

      {isSearching ? (
        <>
          {loading && <p className="text-subtle text-sm">Suche läuft …</p>}
          {!loading && searched && results.length === 0 && (
            <p className="text-subtle text-sm">Keine Karte gefunden.</p>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {results.map((card) => (
              <div key={card.external_id} className="flex flex-col">
                <Link to={`/database/${card.external_id}`} className="flex flex-col group relative">
                  <img
                    src={card.image_large}
                    alt={`${card.name} (Englisch)`}
                    className="rounded-2xl mb-2 border border-line shadow-sm group-hover:border-ink transition"
                  />
                  {user && (
                    <WatchlistHeart
                      externalId={card.external_id}
                      watched={watchedIds.has(card.external_id)}
                      onChange={(now) =>
                        setWatchedIds((prev) => {
                          const next = new Set(prev);
                          now ? next.add(card.external_id) : next.delete(card.external_id);
                          return next;
                        })
                      }
                      className="absolute top-1.5 right-1.5 bg-canvas/90 rounded-full w-7 h-7 flex items-center justify-center text-lg shadow-sm"
                    />
                  )}
                  <p className="text-sm font-medium truncate">{card.name}</p>
                  <p className="text-subtle text-xs truncate">
                    {card.set_name}
                    {card.year ? ` (${card.year})` : ""}
                  </p>
                  <p className="text-subtle text-[11px] mb-2 truncate">
                    {[card.rarity, card.artist && `✎ ${card.artist}`].filter(Boolean).join(" · ")}
                  </p>
                </Link>
                <div className="mt-auto flex gap-2">
                  <Link
                    to={`/database/${card.external_id}`}
                    className="flex-1 text-center border border-line text-xs py-1.5 rounded-full hover:border-ink"
                  >
                    Preisverlauf
                  </Link>
                  <button
                    onClick={() =>
                      user
                        ? setDialogCard(card)
                        : navigate(registrationOpen ? "/register" : "/login")
                    }
                    className="flex-1 border border-line text-xs py-1.5 rounded-full hover:border-ink"
                  >
                    {user ? "+ Sammlung" : "Anmelden"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : view === "movers" ? (
        <MoversBrowser data={movers} loading={moversLoading} />
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
                    <div className="flex items-center gap-2 min-w-0">
                      {(set.logo || set.symbol) && (
                        <img
                          src={set.logo ?? set.symbol}
                          alt=""
                          className="h-8 w-8 object-contain shrink-0"
                        />
                      )}
                      <span className="font-medium text-sm truncate">{set.name}</span>
                    </div>
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
          error={addError}
          onConfirm={confirmAdd}
          onClose={() => !busy && (setDialogCard(null), setAddError(null))}
        />
      )}
      {celebrateCard && (
        <PortfolioAddedAnimation card={celebrateCard} onDone={() => navigate("/")} />
      )}
    </div>
  );
}

// Zeigt die größten Preisausschläge (30 Tage) über alle beobachteten Karten
// hinweg - Vorschläge, welche Karten einen Blick wert sein könnten, nicht
// nur die eigene Sammlung (die hat Collection.jsx/Movers.jsx schon).
function MoversBrowser({ data, loading }) {
  if (loading || !data) return <p className="text-subtle text-sm">Lade Preisbewegungen …</p>;

  const gainers = data.gainers ?? [];
  const losers = data.losers ?? [];
  if (!gainers.length && !losers.length) {
    return (
      <p className="text-subtle text-sm">
        Noch keine ausreichenden Preisdaten für die letzten 30 Tage.
      </p>
    );
  }

  return (
    <div>
      <p className="text-subtle text-sm mb-6">
        Größte Preisausschläge der letzten 30 Tage über {data.trackedCount ?? 0} beobachtete
        Karten hinweg – vielleicht einen Blick wert.
      </p>
      <div className="grid sm:grid-cols-2 gap-x-8 gap-y-6">
        <MoverColumn title="📈 Größte Gewinner" items={gainers} positive />
        <MoverColumn title="📉 Größte Verlierer" items={losers} positive={false} />
      </div>
    </div>
  );
}

function MoverColumn({ title, items, positive }) {
  return (
    <div>
      <p className="text-sm font-medium mb-2">{title}</p>
      {items.length ? (
        <div className="space-y-1">
          {items.map((m) => (
            <Link
              key={m.external_id}
              to={`/database/${m.external_id}`}
              className="flex items-center gap-2 py-1.5 text-sm hover:opacity-80"
            >
              <img src={m.image_small} alt="" className="w-8 h-auto rounded shrink-0" />
              <span className="flex-1 min-w-0 truncate">
                {m.name}
                <span className="text-subtle text-xs block truncate">{m.set_name}</span>
              </span>
              <span className={`font-mono text-xs shrink-0 text-right ${positive ? "text-mint" : "text-rose"}`}>
                {positive ? "+" : "−"}
                {Math.abs(m.delta).toFixed(2)} €
                <span className="text-subtle block">
                  ({positive ? "+" : "−"}
                  {Math.abs(m.delta_pct).toFixed(1)} %)
                </span>
              </span>
            </Link>
          ))}
        </div>
      ) : (
        <p className="text-subtle text-sm">–</p>
      )}
    </div>
  );
}
