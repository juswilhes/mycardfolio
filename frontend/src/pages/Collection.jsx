import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { getCollection, getPortfolioHistory, getMovers } from "../api.js";
import CardTile from "../components/CardTile.jsx";
import PortfolioChart from "../components/PortfolioChart.jsx";
import Movers from "../components/Movers.jsx";

const eur = (n) => `${n.toFixed(2)} €`;

const SORTS = {
  recent: "Zuletzt hinzugefügt",
  bought: "Kaufdatum (neueste zuerst)",
  bought_asc: "Kaufdatum (älteste zuerst)",
  value_desc: "Wert (hoch → niedrig)",
  gain_desc: "Gewinn (hoch → niedrig)",
  gain_asc: "Verlust (niedrig → hoch)",
  name: "Name (A → Z)",
  set: "Set",
  artist: "Zeichner",
};

const val = (i) => (i.latest_price?.price ?? 0) * (i.quantity ?? 1);
const cost = (i) =>
  i.purchase_price != null || i.shipping_cost != null
    ? ((i.purchase_price ?? 0) + (i.shipping_cost ?? 0)) * (i.quantity ?? 1)
    : null;
const gainOf = (i) => {
  const c = cost(i);
  return c != null ? val(i) - c : null;
};

const loadPref = (k, d) => {
  try {
    return localStorage.getItem(`mcf-coll-${k}`) ?? d;
  } catch {
    return d;
  }
};
const savePref = (k, v) => {
  try {
    localStorage.setItem(`mcf-coll-${k}`, v);
  } catch {
    /* ignore */
  }
};

export default function Collection() {
  const [items, setItems] = useState(null);
  const [history, setHistory] = useState(null);
  const [movers, setMovers] = useState(null);

  const [sort, setSort] = useState(() => loadPref("sort", "recent"));
  const [fLang, setFLang] = useState(() => loadPref("lang", "all"));
  const [fSet, setFSet] = useState(() => loadPref("set", "all"));
  const [fArtist, setFArtist] = useState(() => loadPref("artist", "all"));

  useEffect(() => savePref("sort", sort), [sort]);
  useEffect(() => savePref("lang", fLang), [fLang]);
  useEffect(() => savePref("set", fSet), [fSet]);
  useEffect(() => savePref("artist", fArtist), [fArtist]);

  const load = useCallback(() => {
    getCollection().then(setItems).catch(() => setItems([]));
    getPortfolioHistory().then(setHistory).catch(() => setHistory([]));
    getMovers().then(setMovers).catch(() => setMovers(null));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const sets = useMemo(
    () => [...new Set((items ?? []).map((i) => i.set_name).filter(Boolean))].sort(),
    [items]
  );
  const artists = useMemo(
    () => [...new Set((items ?? []).map((i) => i.artist).filter(Boolean))].sort(),
    [items]
  );

  const shown = useMemo(() => {
    let list = (items ?? []).filter(
      (i) =>
        (fLang === "all" || i.language === fLang) &&
        (fSet === "all" || i.set_name === fSet) &&
        (fArtist === "all" || i.artist === fArtist)
    );
    const cmp = {
      recent: () => 0, // API-Reihenfolge = zuletzt hinzugefügt zuerst
      bought: (a, b) => (b.purchase_date ?? "").localeCompare(a.purchase_date ?? ""),
      bought_asc: (a, b) => (a.purchase_date ?? "9999").localeCompare(b.purchase_date ?? "9999"),
      value_desc: (a, b) => val(b) - val(a),
      gain_desc: (a, b) => (gainOf(b) ?? -Infinity) - (gainOf(a) ?? -Infinity),
      gain_asc: (a, b) => (gainOf(a) ?? Infinity) - (gainOf(b) ?? Infinity),
      name: (a, b) => a.name.localeCompare(b.name),
      set: (a, b) => (a.set_name ?? "").localeCompare(b.set_name ?? ""),
      artist: (a, b) => (a.artist ?? "").localeCompare(b.artist ?? ""),
    }[sort];
    return sort === "recent" ? list : [...list].sort(cmp);
  }, [items, sort, fLang, fSet, fArtist]);

  if (items === null) return <p className="text-subtle text-sm">Lade Sammlung …</p>;

  if (items.length === 0) {
    return (
      <div className="text-center py-24">
        <p className="text-lg font-medium mb-1">Noch keine Karten</p>
        <p className="text-subtle mb-6">Füge deine erste Karte hinzu, um den Wert zu verfolgen.</p>
        <Link to="/add" className="inline-block bg-yellow text-yellowInk font-medium px-5 py-2.5 rounded-full">
          Karte hinzufügen
        </Link>
      </div>
    );
  }

  const totalValue = items.reduce((s, i) => s + val(i), 0);
  const totalCards = items.reduce((s, i) => s + (i.quantity ?? 1), 0);
  const withCost = items.filter((i) => cost(i) != null);
  const totalCost = withCost.reduce((s, i) => s + cost(i), 0);
  const gain = withCost.reduce((s, i) => s + val(i), 0) - totalCost;

  const selectCls =
    "border border-line rounded-full px-3 py-1.5 text-xs bg-canvas text-ink focus:outline-none focus:border-ink";

  return (
    <div>
      <div className="bg-surface border border-line rounded-2xl px-6 py-5 mb-6 shadow-sm">
        <div className="flex flex-wrap items-end gap-x-8 gap-y-2">
          <div>
            <p className="text-subtle text-sm">Gesamtwert deiner Sammlung</p>
            <p className="text-4xl font-semibold font-mono">{eur(totalValue)}</p>
            <span className="text-xs text-subtle">{totalCards} Karten im Portfolio</span>
          </div>
          {withCost.length > 0 && (
            <div className="flex gap-6 pb-1">
              <div>
                <p className="text-subtle text-xs">Investiert</p>
                <p className="font-mono text-sm">{eur(totalCost)}</p>
              </div>
              <div>
                <p className="text-subtle text-xs">Gewinn / Verlust</p>
                <p className={`font-mono text-sm ${gain >= 0 ? "text-mint" : "text-rose"}`}>
                  {gain >= 0 ? "+" : "−"}
                  {eur(Math.abs(gain))}
                  {totalCost > 0 && (
                    <span className="text-subtle">
                      {"  "}({gain >= 0 ? "+" : "−"}
                      {Math.abs((gain / totalCost) * 100).toFixed(1)} %)
                    </span>
                  )}
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="mt-4">
          <PortfolioChart data={history} />
        </div>
        {withCost.length > 0 && withCost.length < items.length && (
          <p className="text-[11px] text-subtle mt-1">
            G/V basiert auf {withCost.length} von {items.length} Karten mit hinterlegtem Kaufpreis.
          </p>
        )}
      </div>

      <Movers data={movers} />

      {/* Sortieren & Filtern */}
      <div className="flex flex-wrap gap-2 mb-4">
        <select value={sort} onChange={(e) => setSort(e.target.value)} className={selectCls}>
          {Object.entries(SORTS).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
        <select value={fLang} onChange={(e) => setFLang(e.target.value)} className={selectCls}>
          <option value="all">Alle Sprachen</option>
          <option value="de">Deutsch</option>
          <option value="en">Englisch</option>
        </select>
        {sets.length > 1 && (
          <select value={fSet} onChange={(e) => setFSet(e.target.value)} className={selectCls}>
            <option value="all">Alle Sets</option>
            {sets.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        )}
        {artists.length > 1 && (
          <select value={fArtist} onChange={(e) => setFArtist(e.target.value)} className={selectCls}>
            <option value="all">Alle Zeichner</option>
            {artists.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        )}
        {(fLang !== "all" || fSet !== "all" || fArtist !== "all") && (
          <button
            onClick={() => { setFLang("all"); setFSet("all"); setFArtist("all"); }}
            className="text-xs text-subtle underline px-2"
          >
            Filter zurücksetzen
          </button>
        )}
      </div>

      {shown.length === 0 ? (
        <p className="text-subtle text-sm py-6">Keine Karte passt zu den Filtern.</p>
      ) : (
        <div>
          {shown.map((item) => (
            <CardTile key={item.collection_item_id} item={item} onChanged={load} />
          ))}
        </div>
      )}

      <p className="text-xs text-subtle mt-6">
        <Link to="/verkauft" className="underline hover:text-ink">Verkaufshistorie ansehen</Link>
      </p>
    </div>
  );
}
