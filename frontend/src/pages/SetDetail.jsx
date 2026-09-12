import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { getSet, getCardsForSet, getOwnedInSet, getWatchlistIds } from "../api.js";
import { useAuth } from "../context/AuthContext.jsx";
import WatchlistHeart from "../components/WatchlistHeart.jsx";

const eur = (n) => `${Number(n).toFixed(2)} €`;

const SORTS = {
  number: "Nummer",
  popularity: "Beliebtheit",
  price_desc: "Preis (hoch → niedrig)",
  price_asc: "Preis (niedrig → hoch)",
};

// Route: /sets/:setId  – frei zugänglich. Angemeldet sind Karten, die du
// besitzt, hervorgehoben; ein Filter zeigt wahlweise nur besessene oder
// nur fehlende. Ohne Konto einfach die Kartenübersicht des Sets.
export default function SetDetail() {
  const { user } = useAuth();
  const { setId } = useParams();
  const [set, setSet] = useState(null);
  const [cards, setCards] = useState(null);
  const [owned, setOwned] = useState(new Set());
  const [watchedIds, setWatchedIds] = useState(new Set());
  const [filter, setFilter] = useState("all"); // all | have | missing
  const [sort, setSort] = useState("number");

  useEffect(() => {
    getSet(setId).then(setSet);
    getCardsForSet(setId).then(setCards);
    if (user) {
      getOwnedInSet(setId).then((ids) => setOwned(new Set(ids))).catch(() => setOwned(new Set()));
      getWatchlistIds().then((ids) => setWatchedIds(new Set(ids))).catch(() => {});
    } else {
      setOwned(new Set());
      setWatchedIds(new Set());
    }
  }, [setId, user]);

  const shown = useMemo(() => {
    if (!cards) return [];
    let list = cards;
    if (filter === "have") list = list.filter((c) => owned.has(c.external_id));
    else if (filter === "missing") list = list.filter((c) => !owned.has(c.external_id));

    const cmp = {
      number: (a, b) => (a.number ?? "").localeCompare(b.number ?? "", undefined, { numeric: true }),
      popularity: (a, b) => (b.view_count ?? 0) - (a.view_count ?? 0),
      price_desc: (a, b) => (b.price ?? -1) - (a.price ?? -1),
      price_asc: (a, b) => {
        // Karten ohne Preis ans Ende, nicht künstlich als "billigste" vorne
        if (a.price == null) return 1;
        if (b.price == null) return -1;
        return a.price - b.price;
      },
    }[sort];
    return [...list].sort(cmp);
  }, [cards, owned, filter, sort]);

  const total = cards?.length ?? 0;
  const have = cards ? cards.filter((c) => owned.has(c.external_id)).length : 0;

  const btn = (v, label) => (
    <button
      onClick={() => setFilter(v)}
      className={`text-xs px-3 py-1.5 rounded-full border ${
        filter === v ? "border-ink text-ink" : "border-line text-subtle hover:border-ink"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div>
      <Link to="/sets" className="text-sm text-subtle hover:text-ink">← Alle Sets</Link>

      {set && (
        <div className="flex items-center gap-4 mt-4 mb-4">
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

      {cards && user && (
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <p className="text-sm font-medium">
              Du hast <span className="font-mono">{have}</span> von{" "}
              <span className="font-mono">{total}</span>
            </p>
            <div className="flex-1 h-2 rounded-full bg-line overflow-hidden max-w-xs">
              <div
                className="h-full bg-yellow"
                style={{ width: total ? `${(have / total) * 100}%` : 0 }}
              />
            </div>
          </div>
          <div className="flex gap-2">
            {btn("all", `Alle (${total})`)}
            {btn("have", `Hab ich (${have})`)}
            {btn("missing", `Fehlt mir (${total - have})`)}
          </div>
        </div>
      )}
      {cards && !user && (
        <p className="text-subtle text-sm mb-6">
          {total} Karten in diesem Set.{" "}
          <Link to="/register" className="underline hover:text-ink">
            Anmelden
          </Link>
          , um deinen Sammlungsfortschritt zu sehen.
        </p>
      )}

      {cards && (
        <div className="flex items-center gap-1.5 mb-4">
          <span className="text-xs text-subtle">Sortieren:</span>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="border border-line rounded-full px-3 py-1.5 text-xs bg-canvas text-ink focus:outline-none focus:border-ink"
          >
            {Object.entries(SORTS).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </div>
      )}

      {cards === null ? (
        <p className="text-subtle text-sm">Lade Karten …</p>
      ) : shown.length === 0 ? (
        <p className="text-subtle text-sm">Keine Karte in dieser Ansicht.</p>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-4">
          {shown.map((card) => {
            const has = owned.has(card.external_id);
            return (
              <Link
                key={card.external_id}
                to={`/database/${card.external_id}`}
                className="flex flex-col"
              >
                <div className="relative">
                  <img
                    src={card.image_small}
                    alt={`${card.name} (Englisch)`}
                    className={`rounded-2xl border mb-1.5 shadow-sm transition ${
                      has ? "border-mint" : "border-line opacity-60"
                    }`}
                  />
                  {has && (
                    <span className="absolute top-1 right-1 bg-mint text-white text-[10px] rounded-full w-5 h-5 flex items-center justify-center shadow">
                      ✓
                    </span>
                  )}
                  {user && !has && (
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
                      className="absolute top-1 right-1 bg-canvas/90 rounded-full w-6 h-6 flex items-center justify-center text-base shadow"
                    />
                  )}
                </div>
                <p className="text-xs font-medium truncate">{card.name}</p>
                <div className="flex items-center justify-between">
                  <p className="text-[11px] text-subtle">#{card.number}</p>
                  <p className="text-[11px] font-mono">{card.price != null ? eur(card.price) : "—"}</p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
