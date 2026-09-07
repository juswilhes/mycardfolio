import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getSales, undoSale } from "../api.js";

const eur = (n) => `${Number(n).toFixed(2)} €`;

export default function Sales() {
  const [data, setData] = useState(null);
  const [confirmId, setConfirmId] = useState(null);

  const load = () => getSales().then(setData).catch(() => setData({ sales: [], stats: {} }));
  useEffect(() => {
    load();
  }, []);

  if (!data) return <p className="text-subtle text-sm">Lade Verkäufe …</p>;

  const { sales, stats } = data;

  async function undo(id) {
    await undoSale(id);
    setConfirmId(null);
    load();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold">Verkauft</h1>
        <Link to="/" className="text-sm text-subtle hover:text-ink">← Zur Sammlung</Link>
      </div>

      {sales.length === 0 ? (
        <p className="text-subtle text-sm py-10">
          Noch nichts verkauft. Auf der Detailseite einer Karte in deiner Sammlung
          findest du den Button „Verkauft".
        </p>
      ) : (
        <>
          <div className="bg-surface border border-line rounded-2xl px-6 py-5 mb-6 shadow-sm flex flex-wrap gap-8">
            <div>
              <p className="text-subtle text-xs">Realisierter Gewinn / Verlust</p>
              <p className={`text-3xl font-semibold font-mono ${stats.total_realized >= 0 ? "text-mint" : "text-rose"}`}>
                {stats.total_realized >= 0 ? "+" : "−"}
                {eur(Math.abs(stats.total_realized))}
              </p>
            </div>
            <div>
              <p className="text-subtle text-xs">Erlös gesamt</p>
              <p className="text-sm font-mono mt-1">{eur(stats.total_proceeds)}</p>
            </div>
            <div>
              <p className="text-subtle text-xs">Verkäufe</p>
              <p className="text-sm font-mono mt-1">{stats.count}</p>
            </div>
          </div>

          <div>
            {sales.map((s) => {
              const cost = (s.purchase_price ?? 0) + (s.shipping_cost ?? 0);
              const proceeds =
                (s.sale_price ?? 0) + (s.sale_shipping ?? 0) - (s.sale_fees ?? 0);
              return (
                <div key={s.id} className="flex items-center gap-4 py-4 border-b border-line">
                  <img src={s.image_small} alt="" className="w-12 rounded shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{s.name}</p>
                    <p className="text-subtle text-xs mt-0.5">
                      {s.set_name} · {s.quantity}×
                      {s.sold_on ? ` · ${new Date(s.sold_on).toLocaleDateString("de-DE")}` : ""}
                      {s.language ? ` · ${s.language === "de" ? "DE" : "EN"}` : ""}
                    </p>
                    {s.notes && <p className="text-subtle text-xs truncate">{s.notes}</p>}
                  </div>
                  <div className="text-right shrink-0 text-sm tabular-nums">
                    <p className="font-mono">Erlös {eur(proceeds * s.quantity)}</p>
                    <p className="text-xs">
                      {s.purchase_price != null || s.shipping_cost != null ? (
                        <>
                          <span className="text-subtle">Einstand {eur(cost * s.quantity)}</span>
                          <span className={s.realized >= 0 ? "text-mint ml-2" : "text-rose ml-2"}>
                            {s.realized >= 0 ? "+" : "−"}
                            {eur(Math.abs(s.realized))}
                          </span>
                        </>
                      ) : (
                        <span className="text-subtle">kein Einstand hinterlegt</span>
                      )}
                    </p>
                  </div>
                  {confirmId === s.id ? (
                    <span className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => undo(s.id)}
                        className="text-xs bg-mint text-white rounded-full px-2 py-1"
                      >
                        Zurück in die Sammlung
                      </button>
                      <button onClick={() => setConfirmId(null)} className="text-xs text-subtle px-1">
                        ✕
                      </button>
                    </span>
                  ) : (
                    <button
                      onClick={() => setConfirmId(s.id)}
                      className="text-xs text-subtle hover:text-ink underline shrink-0"
                    >
                      rückgängig
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          <p className="text-[11px] text-subtle mt-3">
            „Rückgängig" macht den Verkauf komplett zurück: die Karte erscheint
            sofort wieder in deiner Sammlung (mit dem ursprünglichen Kaufpreis).
          </p>
        </>
      )}
    </div>
  );
}
