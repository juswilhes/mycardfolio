import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { getCollection, getPortfolioHistory, getMovers } from "../api.js";
import CollectionGroup from "../components/CollectionGroup.jsx";
import PortfolioChart from "../components/PortfolioChart.jsx";
import Movers from "../components/Movers.jsx";
import { SortIcon, FilterIcon } from "../components/icons.jsx";

const eur = (n) => `${n.toFixed(2)} €`;

const SORTS = {
  recent: "Zuletzt hinzugefügt",
  bought: "Kaufdatum (neueste zuerst)",
  bought_asc: "Kaufdatum (älteste zuerst)",
  value_desc: "Wert (hoch → niedrig)",
  gain_desc: "Gewinn € (hoch → niedrig)",
  gain_asc: "Verlust € (niedrig → hoch)",
  gainpct_desc: "Gewinn % (hoch → niedrig)",
  gainpct_asc: "Verlust % (niedrig → hoch)",
  name: "Name (A → Z)",
  set: "Set",
  artist: "Zeichner",
};

const val = (i) => (i.latest_price?.price ?? 0) * (i.quantity ?? 1);
const cost = (i) =>
  i.purchase_price != null || i.shipping_cost != null
    ? ((i.purchase_price ?? 0) + (i.shipping_cost ?? 0)) * (i.quantity ?? 1)
    : null;
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
  const [loadError, setLoadError] = useState(false);
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

  const anyFilter = fLang !== "all" || fSet !== "all" || fArtist !== "all";

  const load = useCallback(() => {
    getCollection()
      .then((data) => {
        setItems(data);
        setLoadError(false);
      })
      .catch(() => {
        setLoadError(true);
        setItems((prev) => prev ?? []);
      });
    getMovers().then(setMovers).catch(() => setMovers(null));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Verlaufsgraph an die aktive Filterung anpassen.
  useEffect(() => {
    if (!items) return;
    setHistory(null);
    getPortfolioHistory({
      set: fSet !== "all" ? fSet : null,
      language: fLang !== "all" ? fLang : null,
      artist: fArtist !== "all" ? fArtist : null,
    })
      .then(setHistory)
      .catch(() => setHistory([]));
  }, [fSet, fLang, fArtist, items]);

  const sets = useMemo(
    () => [...new Set((items ?? []).map((i) => i.set_name).filter(Boolean))].sort(),
    [items]
  );
  const artists = useMemo(
    () => [...new Set((items ?? []).map((i) => i.artist).filter(Boolean))].sort(),
    [items]
  );

  // Aktive Filterung – auch Kennzahlen oben und der Graph richten sich danach.
  const filtered = useMemo(
    () =>
      (items ?? []).filter(
        (i) =>
          (fLang === "all" || i.language === fLang) &&
          (fSet === "all" || i.set_name === fSet) &&
          (fArtist === "all" || i.artist === fArtist)
      ),
    [items, fLang, fSet, fArtist]
  );

  // Karten mit mehreren Käufen zusammenfassen: nach card_id gruppieren,
  // dann die Gruppen sortieren.
  const groups = useMemo(() => {
    const map = new Map();
    filtered.forEach((it, idx) => {
      let g = map.get(it.card_id);
      if (!g) {
        g = {
          card_id: it.card_id,
          name: it.name,
          set_name: it.set_name,
          rarity: it.rarity,
          artist: it.artist,
          image_small: it.image_small,
          latest_price: it.latest_price,
          firstIdx: idx,
          entries: [],
        };
        map.set(it.card_id, g);
      }
      g.entries.push(it);
    });

    const gVal = (g) => (g.latest_price?.price ?? 0) * g.entries.reduce((s, e) => s + (e.quantity ?? 1), 0);
    const gCost = (g) => {
      const w = g.entries.filter((e) => cost(e) != null);
      return w.length ? w.reduce((s, e) => s + cost(e), 0) : null;
    };
    const gGain = (g) => {
      const c = gCost(g);
      if (c == null) return null;
      const w = g.entries.filter((e) => cost(e) != null);
      const q = w.reduce((s, e) => s + (e.quantity ?? 1), 0);
      return (g.latest_price?.price ?? 0) * q - c;
    };
    const gGainPct = (g) => {
      const c = gCost(g);
      const gn = gGain(g);
      if (c == null || gn == null || c <= 0) return null;
      return (gn / c) * 100;
    };
    const sortedDates = (g) => g.entries.map((e) => e.purchase_date).filter(Boolean).sort();
    const newest = (g) => sortedDates(g).at(-1) ?? "";
    const oldest = (g) => sortedDates(g)[0] ?? "";

    const cmp = {
      recent: (a, b) => a.firstIdx - b.firstIdx,
      bought: (a, b) => newest(b).localeCompare(newest(a)),
      bought_asc: (a, b) => (oldest(a) || "9999").localeCompare(oldest(b) || "9999"),
      value_desc: (a, b) => gVal(b) - gVal(a),
      gain_desc: (a, b) => (gGain(b) ?? -Infinity) - (gGain(a) ?? -Infinity),
      gain_asc: (a, b) => (gGain(a) ?? Infinity) - (gGain(b) ?? Infinity),
      gainpct_desc: (a, b) => (gGainPct(b) ?? -Infinity) - (gGainPct(a) ?? -Infinity),
      gainpct_asc: (a, b) => (gGainPct(a) ?? Infinity) - (gGainPct(b) ?? Infinity),
      name: (a, b) => a.name.localeCompare(b.name),
      set: (a, b) => (a.set_name ?? "").localeCompare(b.set_name ?? ""),
      artist: (a, b) => (a.artist ?? "").localeCompare(b.artist ?? ""),
    }[sort];
    return [...map.values()].sort(cmp);
  }, [filtered, sort]);

  if (items === null) return <p className="text-subtle text-sm">Lade Sammlung …</p>;

  if (loadError) {
    return (
      <div className="text-center py-24">
        <p className="text-lg font-medium mb-1">Server nicht erreichbar</p>
        <p className="text-subtle mb-6">
          Deine Karten sind nicht weg – die App kann das Backend gerade nur nicht
          erreichen. Läuft <code>backend</code> (Port 3001)? Sonst
          <code> start-mycardfolio.bat</code> neu starten.
        </p>
        <button
          onClick={load}
          className="inline-block bg-yellow text-yellowInk font-medium px-5 py-2.5 rounded-full"
        >
          Erneut versuchen
        </button>
      </div>
    );
  }

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

  // Kennzahlen oben folgen der aktiven Filterung.
  const base = anyFilter ? filtered : items;
  const totalValue = base.reduce((s, i) => s + val(i), 0);
  const totalCards = base.reduce((s, i) => s + (i.quantity ?? 1), 0);
  const withCost = base.filter((i) => cost(i) != null);
  const totalCost = withCost.reduce((s, i) => s + cost(i), 0);
  const gain = withCost.reduce((s, i) => s + val(i), 0) - totalCost;

  const selectCls =
    "border border-line rounded-full px-3 py-1.5 text-xs bg-canvas text-ink focus:outline-none focus:border-ink";

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">Meine Sammlung</h1>
        <Link
          to="/add"
          className="bg-yellow text-yellowInk font-medium px-4 py-2 rounded-full text-sm"
        >
          + Karte hinzufügen
        </Link>
      </div>

      <div className="bg-surface border border-line rounded-2xl px-6 py-5 mb-6 shadow-sm">
        <div className="flex flex-wrap items-end gap-x-8 gap-y-2">
          <div>
            <p className="text-subtle text-sm">
              {anyFilter ? "Wert der gefilterten Auswahl" : "Gesamtwert deiner Sammlung"}
            </p>
            <p className="text-4xl font-semibold font-mono">{eur(totalValue)}</p>
            <span className="text-xs text-subtle">
              {totalCards} {anyFilter ? "gefilterte Karten" : "Karten im Portfolio"}
            </span>
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
          {history === null ? (
            <p className="text-subtle text-sm py-4">Lade Verlauf …</p>
          ) : (
            <PortfolioChart data={history} />
          )}
        </div>
        {anyFilter && (
          <p className="text-[11px] text-subtle mt-1">
            Wert &amp; Verlauf zeigen nur die gefilterte Auswahl
            {" "}({filtered.length} von {items.length} Einträgen).
          </p>
        )}
        {!anyFilter && withCost.length > 0 && withCost.length < items.length && (
          <p className="text-[11px] text-subtle mt-1">
            G/V basiert auf {withCost.length} von {items.length} Karten mit hinterlegtem Kaufpreis.
          </p>
        )}
      </div>

      <Movers data={movers} />

      {/* Sortieren & Filtern */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-4">
        <div className="flex items-center gap-1.5">
          <SortIcon className="w-4 h-4 text-subtle shrink-0" />
          <span className="sr-only">Sortieren</span>
          <select value={sort} onChange={(e) => setSort(e.target.value)} className={selectCls}>
            {Object.entries(SORTS).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <FilterIcon className="w-4 h-4 text-subtle shrink-0" />
          <span className="sr-only">Filter</span>
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
              zurücksetzen
            </button>
          )}
        </div>
      </div>

      {groups.length === 0 ? (
        <p className="text-subtle text-sm py-6">Keine Karte passt zu den Filtern.</p>
      ) : (
        <div>
          {groups.map((g) => (
            <CollectionGroup key={g.card_id} group={g} onChanged={load} />
          ))}
        </div>
      )}

      <p className="text-xs text-subtle mt-6">
        <Link to="/verkauft" className="underline hover:text-ink">Verkaufshistorie ansehen</Link>
      </p>
    </div>
  );
}
