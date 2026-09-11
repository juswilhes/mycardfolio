import { useMemo, useState } from "react";

const eur = (n) =>
  Number(n).toLocaleString("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 2 });

const Field = ({ label, ...props }) => (
  <label className="block">
    <span className="text-xs text-subtle block mb-1">{label}</span>
    <input
      {...props}
      type="number"
      className="w-full border border-line rounded-full px-3 py-1.5 text-sm bg-canvas text-ink focus:outline-none focus:border-ink"
    />
  </label>
);

// Rein manueller ROI-Rechner fürs Graden: da uns echte PSA-Populationsdaten
// fehlen, füllt hier nichts automatisch vor - der Nutzer trägt seine eigenen
// Annahmen ein, das Tool übernimmt nur die (oft unterschätzte) Rechenarbeit
// mit Gebühren, Versand und realistischer Ausbeute.
export default function GradingCalculator() {
  const [copies, setCopies] = useState(5);
  const [rawPrice, setRawPrice] = useState(20);
  const [psa10Price, setPsa10Price] = useState(120);
  const [nonGemPrice, setNonGemPrice] = useState(15);
  const [gemRate, setGemRate] = useState(50);
  const [gradingFee, setGradingFee] = useState(25);
  const [shipping, setShipping] = useState(15);
  const [sellFeePct, setSellFeePct] = useState(13.25);

  const result = useMemo(() => {
    const n = Math.max(0, Math.round(copies) || 0);
    const gemCount = Math.round((n * (Number(gemRate) || 0)) / 100);
    const nonGemCount = n - gemCount;

    const grossRevenue = gemCount * Number(psa10Price || 0) + nonGemCount * Number(nonGemPrice || 0);
    const sellingFees = grossRevenue * ((Number(sellFeePct) || 0) / 100);
    const netRevenue = grossRevenue - sellingFees;

    const totalCost = n * Number(rawPrice || 0) + n * Number(gradingFee || 0) + Number(shipping || 0);
    const profit = netRevenue - totalCost;
    const roiPct = totalCost > 0 ? (profit / totalCost) * 100 : 0;

    return { n, gemCount, nonGemCount, grossRevenue, sellingFees, netRevenue, totalCost, profit, roiPct };
  }, [copies, rawPrice, psa10Price, nonGemPrice, gemRate, gradingFee, shipping, sellFeePct]);

  return (
    <div className="bg-surface border border-line rounded-2xl px-5 py-4 shadow-sm">
      <div className="grid sm:grid-cols-3 gap-3 mb-4">
        <Field label="Anzahl Karten (Lot)" value={copies} min="1" onChange={(e) => setCopies(e.target.value)} />
        <Field label="Rohkarten-Preis (pro Karte)" value={rawPrice} min="0" step="0.01" onChange={(e) => setRawPrice(e.target.value)} />
        <Field label="Erwarteter PSA-10-Preis" value={psa10Price} min="0" step="0.01" onChange={(e) => setPsa10Price(e.target.value)} />
        <Field label="Verkaufspreis bei Nicht-10" value={nonGemPrice} min="0" step="0.01" onChange={(e) => setNonGemPrice(e.target.value)} />
        <Field label="Erwartete Gem Rate (%)" value={gemRate} min="0" max="100" onChange={(e) => setGemRate(e.target.value)} />
        <Field label="Grading-Gebühr (pro Karte)" value={gradingFee} min="0" step="0.01" onChange={(e) => setGradingFee(e.target.value)} />
        <Field label="Versand gesamt" value={shipping} min="0" step="0.01" onChange={(e) => setShipping(e.target.value)} />
        <Field label="Verkaufsgebühr (%, z. B. eBay)" value={sellFeePct} min="0" max="100" step="0.01" onChange={(e) => setSellFeePct(e.target.value)} />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-line">
        <div>
          <p className="text-xs text-subtle">Erwartete PSA-10</p>
          <p className="font-mono text-sm">{result.gemCount} / {result.n}</p>
        </div>
        <div>
          <p className="text-xs text-subtle">Nettoerlös</p>
          <p className="font-mono text-sm">{eur(result.netRevenue)}</p>
        </div>
        <div>
          <p className="text-xs text-subtle">Gesamtkosten</p>
          <p className="font-mono text-sm">{eur(result.totalCost)}</p>
        </div>
        <div>
          <p className="text-xs text-subtle">Gewinn / ROI</p>
          <p className={`font-mono text-sm font-semibold ${result.profit >= 0 ? "text-mint" : "text-rose"}`}>
            {result.profit >= 0 ? "+" : "−"}
            {eur(Math.abs(result.profit))} ({result.roiPct >= 0 ? "+" : ""}
            {result.roiPct.toFixed(0)} %)
          </p>
        </div>
      </div>
    </div>
  );
}
