import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { getCollection, getMovers, getSets, getSetProgress } from "../api.js";
import MarketMovers from "../components/MarketMovers.jsx";
import Movers from "../components/Movers.jsx";

const eur = (n) => `${Number(n).toFixed(2)} €`;
const eur0 = (n) =>
  Number(n).toLocaleString("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

const PALETTE = ["#f8c93a", "#5a9bff", "#35d488", "#ff6b81", "#c98bff", "#f2994a", "#56ccf2", "#b0a08a"];

const val = (i) => (i.latest_price?.price ?? 0) * (i.quantity ?? 1);
const cost = (i) =>
  i.purchase_price != null || i.shipping_cost != null
    ? ((i.purchase_price ?? 0) + (i.shipping_cost ?? 0)) * (i.quantity ?? 1)
    : null;

// Wert-Aufschlüsselung nach einem Feld, sortiert, mit optionalem "Sonstige".
function breakdownBy(items, keyFn, limit) {
  const map = new Map();
  for (const i of items) {
    const k = keyFn(i) || "–";
    map.set(k, (map.get(k) ?? 0) + val(i));
  }
  let rows = [...map.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
  if (limit && rows.length > limit) {
    const rest = rows.slice(limit).reduce((s, r) => s + r.value, 0);
    rows = [...rows.slice(0, limit), { label: "Sonstige", value: rest }];
  }
  return rows;
}

function BarList({ rows, total }) {
  return (
    <div className="space-y-2">
      {rows.map((r, idx) => (
        <div key={r.label}>
          <div className="flex justify-between text-sm">
            <span className="truncate pr-2">{r.label}</span>
            <span className="font-mono shrink-0">{eur(r.value)}</span>
          </div>
          <div className="h-1.5 rounded-full bg-line overflow-hidden mt-0.5">
            <div
              className="h-full"
              style={{
                width: total ? `${(r.value / total) * 100}%` : 0,
                background: PALETTE[idx % PALETTE.length],
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

// Route: /statistik – zwei Auswahlen: "Markt" (marktweite Bewegungen, alle
// jemals angesehenen Karten) und "Meine Sammlung" (die bisherige,
// personenbezogene Auswertung). Markt ist die erste/voreingestellte Ansicht.
export default function Stats() {
  const [tab, setTab] = useState("markt");

  return (
    <div>
      <h1 className="text-xl font-semibold mb-4">Statistik</h1>

      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setTab("markt")}
          className={`text-sm px-4 py-2 rounded-full border ${
            tab === "markt" ? "border-ink text-ink font-medium" : "border-line text-subtle hover:border-ink"
          }`}
        >
          Markt
        </button>
        <button
          onClick={() => setTab("sammlung")}
          className={`text-sm px-4 py-2 rounded-full border ${
            tab === "sammlung" ? "border-ink text-ink font-medium" : "border-line text-subtle hover:border-ink"
          }`}
        >
          Meine Sammlung
        </button>
      </div>

      {tab === "markt" ? <MarketMovers /> : <CollectionStats />}
    </div>
  );
}

function CollectionStats() {
  const [items, setItems] = useState(null);
  const [movers, setMovers] = useState(null);
  const [setDefs, setSetDefs] = useState(null);
  const [setOwned, setSetOwned] = useState({});

  useEffect(() => {
    getCollection().then(setItems).catch(() => setItems([]));
    getMovers().then(setMovers).catch(() => setMovers(null));
    getSets().then(setSetDefs).catch(() => setSetDefs([]));
    getSetProgress().then(setSetOwned).catch(() => setSetOwned({}));
  }, []);

  const data = useMemo(() => {
    if (!items) return null;
    const totalValue = items.reduce((s, i) => s + val(i), 0);
    const withCost = items.filter((i) => cost(i) != null);
    const totalCost = withCost.reduce((s, i) => s + cost(i), 0);
    const gain = withCost.reduce((s, i) => s + val(i), 0) - totalCost;
    const bySet = breakdownBy(items, (i) => i.set_name, 8);
    const byRarity = breakdownBy(items, (i) => i.rarity, 7);
    const byArtist = breakdownBy(items, (i) => i.artist, 8);
    const byLang = breakdownBy(items, (i) => (i.language === "de" ? "Deutsch" : "Englisch"));
    const top = [...items].sort((a, b) => val(b) - val(a)).slice(0, 10);
    const totalCards = items.reduce((s, i) => s + (i.quantity ?? 1), 0);
    const avgValue = totalCards ? totalValue / totalCards : 0;
    return { totalValue, totalCost, gain, withCost, bySet, byRarity, byArtist, byLang, top, totalCards, avgValue };
  }, [items]);

  // Sets, an denen der Nutzer schon dran ist, nach Fortschritt sortiert -
  // "was fehlt mir noch, um ein Set fertigzumachen".
  const setProgress = useMemo(() => {
    if (!setDefs) return [];
    return setDefs
      .map((s) => ({ ...s, owned: setOwned[s.id] ?? 0 }))
      .filter((s) => s.total > 0 && s.owned > 0)
      .map((s) => ({ ...s, pct: s.owned / s.total }))
      .sort((a, b) => b.pct - a.pct)
      .slice(0, 6);
  }, [setDefs, setOwned]);

  if (!items) return <p className="text-subtle text-sm">Lade Statistik …</p>;
  if (items.length === 0) {
    return (
      <div className="py-16 text-center">
        <p className="text-subtle mb-4">Noch keine Karten – nichts auszuwerten.</p>
        <Link to="/sets" className="inline-block bg-yellow text-yellowInk font-medium px-5 py-2.5 rounded-full">
          Karte hinzufügen
        </Link>
      </div>
    );
  }

  const { totalValue, totalCost, gain, withCost, bySet, byRarity, byArtist, byLang, top, totalCards, avgValue } = data;

  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <Stat label="Gesamtwert" value={eur(totalValue)} />
        <Stat label="Karten" value={totalCards} />
        <Stat label="Ø Kartenwert" value={eur(avgValue)} />
        {withCost.length > 0 ? (
          <Stat
            label="Gewinn / Verlust"
            value={`${gain >= 0 ? "+" : "−"}${eur(Math.abs(gain))}`}
            tone={gain >= 0 ? "mint" : "rose"}
          />
        ) : (
          <Stat label="Wertvollste Karte" value={eur(top[0] ? val(top[0]) : 0)} />
        )}
      </div>

      <Movers data={movers} title="📈 Deine Top-Bewegungen (7 Tage)" />

      {setProgress.length > 0 && (
        <section className="mb-8">
          <h2 className="text-sm text-subtle mb-3">
            🧩 Set-Fortschritt – was fehlt noch, um ein Set fertigzumachen?
          </h2>
          <div className="grid sm:grid-cols-2 gap-x-8 gap-y-3">
            {setProgress.map((s) => (
              <Link key={s.id} to={`/sets/${s.id}`} className="block group">
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="truncate group-hover:text-ink">{s.name}</span>
                  <span className="text-subtle text-xs shrink-0 ml-2">
                    {s.owned} / {s.total} · fehlen {s.total - s.owned}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-line overflow-hidden">
                  <div className="h-full bg-yellow" style={{ width: `${s.pct * 100}%` }} />
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <div className="grid md:grid-cols-2 gap-8">
        <section>
          <h2 className="text-sm text-subtle mb-3">Wert nach Set</h2>
          <BarList rows={bySet} total={totalValue} />
        </section>

        <section>
          <h2 className="text-sm text-subtle mb-3">Wert nach Seltenheit</h2>
          <div className="flex items-center gap-4">
            <ResponsiveContainer width={140} height={140}>
              <PieChart>
                <Pie data={byRarity} dataKey="value" nameKey="label" innerRadius={38} outerRadius={65} paddingAngle={2}>
                  {byRarity.map((_, i) => (
                    <Cell key={i} fill={PALETTE[i % PALETTE.length]} stroke="none" />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(v, n) => [eur(v), n]}
                  contentStyle={{
                    background: "var(--surface)",
                    border: "1px solid var(--line)",
                    borderRadius: 8,
                    fontSize: 12,
                    color: "var(--ink)",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <ul className="text-xs space-y-1 flex-1 min-w-0">
              {byRarity.map((r, i) => (
                <li key={r.label} className="flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-sm shrink-0"
                    style={{ background: PALETTE[i % PALETTE.length] }}
                  />
                  <span className="truncate flex-1">{r.label}</span>
                  <span className="font-mono text-subtle">{eur0(r.value)}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </div>

      <section className="mt-8">
        <h2 className="text-sm text-subtle mb-3">Deine 10 größten Positionen</h2>
        <div>
          {top.map((i, idx) => (
            <Link
              key={i.collection_item_id}
              to={`/card/${i.card_id}`}
              className="flex items-center gap-3 py-2.5 border-b border-line text-sm"
            >
              <span className="text-subtle w-5 text-right shrink-0">{idx + 1}</span>
              <img src={i.image_small} alt="" className="w-8 rounded shrink-0" />
              <span className="flex-1 min-w-0">
                <span className="font-medium">{i.name}</span>
                <span className="text-subtle text-xs"> · {i.set_name}</span>
              </span>
              <span className="font-mono shrink-0">{eur(val(i))}</span>
            </Link>
          ))}
        </div>
      </section>

      <div className="grid md:grid-cols-2 gap-8 mt-8">
        <section className="max-w-xs">
          <h2 className="text-sm text-subtle mb-3">Wert nach Sprache</h2>
          <BarList rows={byLang} total={totalValue} />
        </section>

        <section>
          <h2 className="text-sm text-subtle mb-3">Wert nach Illustrator</h2>
          <BarList rows={byArtist} total={totalValue} />
        </section>
      </div>
    </div>
  );
}

function Stat({ label, value, tone }) {
  return (
    <div className="bg-surface border border-line rounded-2xl px-4 py-3">
      <p className="text-xs text-subtle">{label}</p>
      <p
        className={`text-lg font-semibold font-mono ${
          tone === "mint" ? "text-mint" : tone === "rose" ? "text-rose" : ""
        }`}
      >
        {value}
      </p>
    </div>
  );
}
