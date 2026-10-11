import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { LineChart, Line, YAxis, ResponsiveContainer } from "recharts";
import { getCollection, getPortfolioHistory } from "../api.js";
import { eur } from "../lib/format.js";
import { withinDays } from "../lib/chartRange.js";

// Rechnung wie auf "Meine Sammlung": jeder Eintrag mit dem Preis SEINER Variante.
const val = (i) => (i.latest_price?.price ?? 0) * (i.quantity ?? 1);
const cost = (i) =>
  i.purchase_price != null || i.shipping_cost != null
    ? ((i.purchase_price ?? 0) + (i.shipping_cost ?? 0)) * (i.quantity ?? 1)
    : null;

// Kleines Fenster mit dem eigenen Portfolio für die Startseite (angemeldet).
export default function PortfolioWindow() {
  const [items, setItems] = useState(null);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    getCollection().then(setItems).catch(() => setItems(false));
    getPortfolioHistory().then(setHistory).catch(() => setHistory([]));
  }, []);

  const shell = "bg-surface border border-line rounded-2xl px-6 py-5 mb-10 shadow-sm";

  if (items === null) return <div className={shell}><p className="text-subtle text-sm">Lade dein Portfolio …</p></div>;
  if (items === false) {
    return (
      <div className={shell}>
        <p className="text-subtle text-sm">Dein Portfolio lässt sich gerade nicht laden. <Link to="/sammlung" className="underline">Zur Sammlung</Link></p>
      </div>
    );
  }
  if (items.length === 0) {
    return (
      <div className={`${shell} text-center`}>
        <p className="font-medium mb-1">Noch keine Karten im Portfolio</p>
        <p className="text-subtle text-sm mb-4">Füge deine erste Karte hinzu, um den Wert zu verfolgen.</p>
        <Link to="/sets" className="inline-block bg-yellow text-yellowInk font-medium px-5 py-2 rounded-full text-sm">
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
  const spark = withinDays(history ?? [], 30, (d) => d.captured_on).map((d) => ({ v: d.total_value }));

  return (
    <div className={shell}>
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
        <div>
          <p className="text-subtle text-sm">Dein Portfolio</p>
          <p className="text-3xl font-semibold font-mono">{eur(totalValue)}</p>
          <p className="text-xs text-subtle mt-0.5">
            {totalCards} Karten
            {withCost.length > 0 && (
              <>
                {" · "}
                <span className={gain >= 0 ? "text-mint" : "text-rose"}>
                  {gain >= 0 ? "+" : "−"}
                  {eur(Math.abs(gain))}
                  {totalCost > 0 && ` (${gain >= 0 ? "+" : "−"}${Math.abs((gain / totalCost) * 100).toFixed(1)} %)`}
                </span>{" "}
                gegenüber dem Kaufpreis
              </>
            )}
          </p>
        </div>
        {spark.length >= 2 && (
          <div className="w-40 h-14 shrink-0" aria-hidden="true">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={spark}>
                <YAxis hide domain={["dataMin", "dataMax"]} />
                <Line type="monotone" dataKey="v" stroke="var(--yellow)" strokeWidth={2} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
      <div className="flex flex-wrap gap-2 mt-4">
        <Link to="/sammlung" className="bg-yellow text-yellowInk font-medium px-4 py-2 rounded-full text-sm">
          Zur Sammlung
        </Link>
        <Link to="/sets" className="border border-line px-4 py-2 rounded-full text-sm hover:border-ink">
          Karte hinzufügen
        </Link>
        <Link to="/analyse" className="border border-line px-4 py-2 rounded-full text-sm hover:border-ink">
          Analyse
        </Link>
      </div>
      {spark.length >= 2 && <p className="text-[11px] text-subtle mt-2">Verlauf der letzten 30 Tage.</p>}
    </div>
  );
}
