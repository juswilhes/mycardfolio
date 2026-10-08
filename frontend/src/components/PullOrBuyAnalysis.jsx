import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { getPullOrBuy } from "../api.js";
import { eur, eur0 } from "../lib/format.js";
import { rarityLabel } from "../lib/rarity.js";

const SORTS = {
  price: { label: "Kaufpreis", fn: (a, b) => b.price - a.price },
  cost: { label: "Kosten zum Ziehen", fn: (a, b) => (b.cost ?? -1) - (a.cost ?? -1) },
  factor: { label: "Ziehen teurer als Kaufen (Faktor)", fn: (a, b) => (b.factor ?? -1) - (a.factor ?? -1) },
  chance: { label: "Chance mit einem Display", fn: (a, b) => b.chanceBox - a.chanceBox },
};

const dash = <span className="text-subtle">–</span>;
const num = (v, digits = 1) => v.toLocaleString("de-DE", { maximumFractionDigits: digits });

// Analyse "Ziehen oder kaufen": was kostet es im Schnitt, eine Chase-Karte aus
// Boostern zu ziehen (Quote pro Karte x Boosterpreis), und wie verhält sich das
// zum Preis, zu dem man sie direkt kaufen kann? Die Karten kommen vom Server
// (backend/services/marketStats.js getPullOrBuy), gerechnet wird hier, weil
// es vom Boosterpreis abhängt.
export default function PullOrBuyAnalysis() {
  const [sets, setSets] = useState(null);
  const [setId, setSetId] = useState(null);
  const [rarity, setRarity] = useState("");
  const [sort, setSort] = useState("price");

  useEffect(() => {
    getPullOrBuy()
      .then((list) => {
        const withCards = list.filter((s) => s.cards.length > 0);
        setSets(withCards);
        setSetId((cur) => cur ?? (withCards.find((s) => s.boosterPriceCents != null) ?? withCards[0])?.id ?? null);
      })
      .catch(() => setSets([]));
  }, []);

  const set = sets?.find((s) => s.id === setId) ?? null;
  const booster = set?.boosterPriceCents != null ? set.boosterPriceCents / 100 : null;

  const cards = useMemo(() => {
    if (!set) return [];
    return set.cards
      .filter((c) => !rarity || c.rarity === rarity)
      .map((c) => {
        const y = c.specificDenominator;
        const cost = booster != null ? y * booster : null;
        return {
          ...c,
          cost,
          factor: cost != null ? cost / c.price : null,
          // Chance, die Karte in einem Display (Booster-Anzahl) mindestens einmal zu ziehen
          chanceBox: (1 - Math.pow(1 - 1 / y, set.packsPerBox)) * 100,
        };
      })
      .sort(SORTS[sort].fn);
  }, [set, booster, rarity, sort]);

  if (sets === null) return <p className="text-subtle text-sm">Lade Auswertung …</p>;
  if (sets.length === 0) return <p className="text-subtle text-sm">Noch keine Pull Rates hinterlegt.</p>;

  const rarities = [...new Set(set.cards.map((c) => c.rarity))];
  const select =
    "border border-line rounded-full px-3 py-1.5 text-xs bg-canvas text-ink focus:outline-none focus:border-ink";

  return (
    <div className="mb-10">
      <h2 className="text-sm font-medium mb-1">🎲 Ziehen oder kaufen?</h2>
      <p className="text-xs text-subtle mb-3">
        Eine Karte mit der Quote <b>1/480</b> steckt im Schnitt in jedem 480. Pack. Das Ziehen kostet dann im Schnitt
        480 Booster zum Boosterpreis. Hier steht daneben, was die Karte einzeln kostet. Der <b>Faktor</b> zeigt, wie
        viel teurer das Ziehen ist als das Kaufen (3× = dreimal so teuer). Nicht gerechnet ist, was die übrigen Karten
        aus den Packs wert sind – siehe „Wert pro Pack". Es sind Durchschnittswerte: Mit Glück zieht man sie im
        ersten Pack, mit Pech nach dem Doppelten.
      </p>

      <div className="flex flex-wrap gap-2 mb-3">
        <select
          value={setId}
          onChange={(e) => {
            setSetId(e.target.value);
            setRarity("");
          }}
          className={select}
        >
          {sets.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
              {s.release_date ? ` (${s.release_date.slice(0, 4)})` : ""}
            </option>
          ))}
        </select>
        <select value={rarity} onChange={(e) => setRarity(e.target.value)} className={select}>
          <option value="">Alle Seltenheiten</option>
          {rarities.map((r) => (
            <option key={r} value={r}>
              {rarityLabel(r)}
            </option>
          ))}
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value)} className={select}>
          {Object.entries(SORTS).map(([v, { label }]) => (
            <option key={v} value={v}>
              Sortieren: {label}
            </option>
          ))}
        </select>
      </div>

      <p className="text-xs text-subtle mb-3">
        Boosterpreis:{" "}
        {booster != null ? (
          <b className="text-ink font-mono">{eur(booster)}</b>
        ) : (
          <>noch nicht hinterlegt – bitte unter „Booster vs. Top-Karten" eintragen, dann erscheinen die Kosten.</>
        )}
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-subtle border-b border-line">
              <th className="py-2 pr-3 font-normal">Karte</th>
              <th className="py-2 pr-3 font-normal text-right">Kaufpreis</th>
              <th className="py-2 pr-3 font-normal text-right">Quote</th>
              <th className="py-2 pr-3 font-normal text-right">Kosten zum Ziehen</th>
              <th className="py-2 pr-3 font-normal text-right">Faktor</th>
              <th className="py-2 pr-3 font-normal text-right">Chance mit 1 Display</th>
            </tr>
          </thead>
          <tbody>
            {cards.map((c) => (
              <tr key={c.external_id} className="border-b border-line">
                <td className="py-2 pr-3">
                  <Link to={`/database/${c.external_id}`} className="flex items-center gap-3 group">
                    <img src={c.image_small} alt="" className="w-9 rounded shrink-0" loading="lazy" />
                    <span className="min-w-0">
                      <span className="block truncate group-hover:underline">{c.name}</span>
                      <span className="block text-[11px] text-subtle truncate">
                        {rarityLabel(c.rarity)}
                        {c.number ? ` · ${c.number}` : ""}
                      </span>
                    </span>
                  </Link>
                </td>
                <td className="py-2 pr-3 text-right font-mono">{eur(c.price)}</td>
                <td className="py-2 pr-3 text-right font-mono">1/{c.specificDenominator}</td>
                <td className="py-2 pr-3 text-right font-mono">{c.cost != null ? eur0(c.cost) : dash}</td>
                <td className="py-2 pr-3 text-right font-mono">
                  {c.factor != null ? (
                    <span className={c.factor >= 1 ? "text-rose" : "text-mint"} title={c.factor >= 1 ? "Kaufen ist günstiger" : "Ziehen ist im Schnitt günstiger"}>
                      {num(c.factor)}×
                    </span>
                  ) : (
                    dash
                  )}
                </td>
                <td className="py-2 pr-3 text-right font-mono">{num(c.chanceBox, c.chanceBox < 10 ? 1 : 0)} %</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
