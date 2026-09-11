import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  getCollection,
  getPortfolioHistory,
  getMovers,
  getSets,
  getSetProgress,
  getAchievements,
} from "../api.js";
import CollectionGroup from "../components/CollectionGroup.jsx";
import PortfolioChart from "../components/PortfolioChart.jsx";
import Movers from "../components/Movers.jsx";
import OrdenBadge from "../components/OrdenBadge.jsx";
import OrdenUnlockAnimation from "../components/OrdenUnlockAnimation.jsx";
import { SortIcon, FilterIcon, SearchIcon } from "../components/icons.jsx";

const ORDEN_SEEN_KEY = "mcf-orden-seen";

// Vergleicht frisch geladene Orden mit den zuletzt gesehenen (localStorage)
// und gibt die neu freigeschalteten zurück. Beim allerersten Check in
// diesem Browser wird nur eine Basislinie gesetzt, ohne zu feiern - sonst
// würden nach dem Feature-Launch alle bereits vorhandenen Orden auf einmal
// als "neu" durchgehen.
function detectNewlyEarned(list) {
  let seenRaw;
  try {
    seenRaw = localStorage.getItem(ORDEN_SEEN_KEY);
  } catch {
    return [];
  }
  const earnedIds = list.filter((a) => a.earned).map((a) => a.id);
  if (seenRaw === null) {
    try {
      localStorage.setItem(ORDEN_SEEN_KEY, JSON.stringify(earnedIds));
    } catch {
      /* ignore */
    }
    return [];
  }
  let seen;
  try {
    seen = new Set(JSON.parse(seenRaw));
  } catch {
    seen = new Set();
  }
  const newly = list.filter((a) => a.earned && !seen.has(a.id));
  try {
    localStorage.setItem(ORDEN_SEEN_KEY, JSON.stringify([...new Set([...seen, ...earnedIds])]));
  } catch {
    /* ignore */
  }
  return newly;
}

const eur = (n) => `${n.toFixed(2)} €`;

// Apostroph/Groß-Klein ignorieren, damit "Ns Zekrom" auch "N's Zekrom" in
// der eigenen Sammlung findet - gleiche Logik wie in der Kartendatenbank.
const normQ = (s) => (s ?? "").toLowerCase().replace(/['’‘]/g, "");

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

// Wenn das Backend nicht antwortet – lieber mit einem Schmunzeln.
const DOWN_MESSAGES = [
  {
    title: "Ein wildes Relaxo versperrt den Weg 😴",
    body: "Es hat sich quer vor den Server gelegt und denkt gar nicht ans Aufstehen. Deine Karten sind natürlich alle noch da.",
  },
  {
    title: "Der Server ist kurz Karten sortieren 🃏",
    body: "Gleich zurück. Deine Sammlung ist sicher – nur die Verbindung zum Backend (Port 3001) hakt gerade.",
  },
  {
    title: "Team Rocket hat den Server geklaut! 🚀",
    body: "Keine Sorge, deine Karten sind nicht dabei – die liegen unberührt in der Datenbank. Der Server kommt gleich wieder.",
  },
  {
    title: "Server-Pokémon ist eingeschläfert 💤",
    body: "Ein Statusproblem, kein Datenproblem: deine Karten sind vollständig da, das Backend antwortet nur gerade nicht.",
  },
  {
    title: "Kurze Kaffeepause vom Server ☕",
    body: "Er tankt Energie und ist gleich zurück. Deine Sammlung wartet geduldig in der Datenbank.",
  },
];

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
  const [setDefs, setSetDefs] = useState(null);
  const [setOwned, setSetOwned] = useState({});
  const [achievements, setAchievements] = useState(null);
  const [unlockQueue, setUnlockQueue] = useState([]);
  const down = useMemo(
    () => DOWN_MESSAGES[Math.floor(Math.random() * DOWN_MESSAGES.length)],
    []
  );

  const [sort, setSort] = useState(() => loadPref("sort", "recent"));
  const [fLang, setFLang] = useState(() => loadPref("lang", "all"));
  const [fSet, setFSet] = useState(() => loadPref("set", "all"));
  const [fArtist, setFArtist] = useState(() => loadPref("artist", "all"));
  const [query, setQuery] = useState("");

  useEffect(() => savePref("sort", sort), [sort]);
  useEffect(() => savePref("lang", fLang), [fLang]);
  useEffect(() => savePref("set", fSet), [fSet]);
  useEffect(() => savePref("artist", fArtist), [fArtist]);

  const anyFilter = fLang !== "all" || fSet !== "all" || fArtist !== "all" || query.trim() !== "";

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
    getSets().then(setSetDefs).catch(() => setSetDefs([]));
    getSetProgress().then(setSetOwned).catch(() => setSetOwned({}));
    getAchievements()
      .then((list) => {
        setAchievements(list);
        const newly = detectNewlyEarned(list);
        if (newly.length) setUnlockQueue((prev) => [...prev, ...newly]);
      })
      .catch(() => setAchievements(null));
  }, [load]);

  // Die 3 Sets, an denen am meisten "dran" ist - also am weitesten fortgeschritten,
  // aber noch nicht komplett.
  const topSets = useMemo(() => {
    if (!setDefs) return [];
    return setDefs
      .map((s) => ({ ...s, owned: setOwned[s.id] ?? 0 }))
      .filter((s) => s.total > 0 && s.owned > 0)
      .map((s) => ({ ...s, pct: s.owned / s.total }))
      .sort((a, b) => b.pct - a.pct)
      .slice(0, 3);
  }, [setDefs, setOwned]);

  const nextAchievement = useMemo(() => {
    if (!achievements) return null;
    const open = achievements.filter((a) => !a.earned);
    if (!open.length) return null;
    return open.sort((a, b) => b.current / b.target - a.current / a.target)[0];
  }, [achievements]);
  const earnedCount = achievements ? achievements.filter((a) => a.earned).length : 0;

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
  const nq = normQ(query);
  const filtered = useMemo(
    () =>
      (items ?? []).filter(
        (i) =>
          (fLang === "all" || i.language === fLang) &&
          (fSet === "all" || i.set_name === fSet) &&
          (fArtist === "all" || i.artist === fArtist) &&
          (!nq || normQ(i.name).includes(nq))
      ),
    [items, fLang, fSet, fArtist, nq]
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
      <div className="text-center py-24 max-w-md mx-auto">
        <p className="text-lg font-medium mb-1">{down.title}</p>
        <p className="text-subtle mb-2">{down.body}</p>
        <p className="text-xs text-subtle mb-6">
          Falls es länger dauert: <code>start-mycardfolio.bat</code> neu starten
          (startet das Backend notfalls mehrmals, bis es läuft).
        </p>
        <button
          onClick={load}
          className="inline-block bg-yellow text-yellowInk font-medium px-5 py-2.5 rounded-full"
        >
          Nochmal versuchen
        </button>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-24">
        <p className="text-lg font-medium mb-1">Noch keine Karten</p>
        <p className="text-subtle mb-6">Füge deine erste Karte hinzu, um den Wert zu verfolgen.</p>
        <Link to="/sets" className="inline-block bg-yellow text-yellowInk font-medium px-5 py-2.5 rounded-full">
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
          to="/sets"
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

      <div className="grid sm:grid-cols-2 gap-4 mb-8">
        <div className="bg-surface border border-line rounded-2xl px-5 py-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium">🧩 Sets im Blick</p>
            <Link to="/sets" className="text-xs text-subtle hover:text-ink underline">
              Alle Sets
            </Link>
          </div>
          {topSets.length === 0 ? (
            <p className="text-subtle text-sm">
              Noch kein Set begonnen. <Link to="/sets" className="underline hover:text-ink">Jetzt stöbern</Link>.
            </p>
          ) : (
            <div className="space-y-2.5">
              {topSets.map((s) => (
                <Link key={s.id} to={`/sets/${s.id}`} className="block group">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="truncate group-hover:text-ink">{s.name}</span>
                    <span className="text-subtle shrink-0 ml-2">
                      {s.owned} / {s.total}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-line overflow-hidden">
                    <div className="h-full bg-yellow" style={{ width: `${s.pct * 100}%` }} />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="bg-surface border border-line rounded-2xl px-5 py-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium">🏅 Ordenkoffer</p>
            <Link to="/orden" className="text-xs text-subtle hover:text-ink underline">
              Ansehen
            </Link>
          </div>
          {achievements === null ? (
            <p className="text-subtle text-sm">Lade …</p>
          ) : (
            <>
              <p className="text-xs text-subtle mb-1.5">{earnedCount} von {achievements.length} Orden gesammelt</p>
              <div className="h-1.5 rounded-full bg-line overflow-hidden mb-3">
                <div
                  className="h-full bg-yellow"
                  style={{ width: `${(earnedCount / achievements.length) * 100}%` }}
                />
              </div>
              {nextAchievement && (
                <Link to="/orden" className="flex items-center gap-2 text-xs hover:text-ink group">
                  <OrdenBadge id={nextAchievement.id} earned={false} size={28} />
                  <span className="text-subtle group-hover:text-ink">
                    Nächster Orden: <b className="text-ink">{nextAchievement.title}</b>{" "}
                    ({Math.min(nextAchievement.current, nextAchievement.target)}/{nextAchievement.target})
                  </span>
                </Link>
              )}
            </>
          )}
        </div>
      </div>

      <Movers data={movers} />

      {/* Suchen, Sortieren & Filtern */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-4">
        <div className="flex items-center gap-1.5">
          <SearchIcon className="w-4 h-4 text-subtle shrink-0" />
          <span className="sr-only">Suchen</span>
          <div className="relative">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Karte in meiner Sammlung suchen …"
              className="border border-line rounded-full pl-3 pr-7 py-1.5 text-xs bg-canvas text-ink focus:outline-none focus:border-ink w-56"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                aria-label="Suche zurücksetzen"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-subtle hover:text-ink"
              >
                ×
              </button>
            )}
          </div>
        </div>

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
              Filter zurücksetzen
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

      {unlockQueue.length > 0 && (
        <OrdenUnlockAnimation
          achievement={unlockQueue[0]}
          onDone={() => setUnlockQueue((q) => q.slice(1))}
        />
      )}
    </div>
  );
}
