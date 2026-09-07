import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { getSet, getCardsForSet, getOwnedInSet } from "../api.js";

// Route: /sets/:setId  – Set-Kopf + Raster aller Karten. Karten, die du
// besitzt, sind hervorgehoben; ein Filter zeigt wahlweise nur besessene
// oder nur fehlende.
export default function SetDetail() {
  const { setId } = useParams();
  const [set, setSet] = useState(null);
  const [cards, setCards] = useState(null);
  const [owned, setOwned] = useState(new Set());
  const [filter, setFilter] = useState("all"); // all | have | missing

  useEffect(() => {
    getSet(setId).then(setSet);
    getCardsForSet(setId).then(setCards);
    getOwnedInSet(setId).then((ids) => setOwned(new Set(ids))).catch(() => setOwned(new Set()));
  }, [setId]);

  const shown = useMemo(() => {
    if (!cards) return [];
    if (filter === "have") return cards.filter((c) => owned.has(c.external_id));
    if (filter === "missing") return cards.filter((c) => !owned.has(c.external_id));
    return cards;
  }, [cards, owned, filter]);

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

      {cards && (
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
                </div>
                <p className="text-xs font-medium truncate">{card.name}</p>
                <p className="text-[11px] text-subtle">#{card.number}</p>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
