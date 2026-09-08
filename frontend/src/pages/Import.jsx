import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { matchImportRows, commitImport } from "../api.js";
import { parseImport, normCondition, normLanguage, normVariant } from "../lib/parseImport.js";
import { CONDITIONS, VARIANTS } from "../components/CollectionItemDialog.jsx";

const num = (v) => {
  const n = parseFloat(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

const FIELD_LABELS = {
  name: "Name",
  number: "Nummer",
  set: "Set",
  quantity: "Menge",
  price: "Kaufpreis",
  shipping: "Versand",
  condition: "Zustand",
  language: "Sprache",
  variant: "Variante",
  date: "Kaufdatum",
  notes: "Notiz",
};

const EXAMPLE = `Name\tNummer\tMenge\tKaufpreis\tSprache
Glurak ex\t223/197\t1\t85,00\tde
Relaxo\t\t2\t4,50\ten
Pikachu VMAX\tTG17\t1\t12,00\tde`;

export default function Import() {
  const navigate = useNavigate();
  const [text, setText] = useState("");
  const [step, setStep] = useState("input"); // input | preview | done
  const [busy, setBusy] = useState(false);
  const [matched, setMatched] = useState([]); // [{ input, best, candidates, chosen, include, quantity, price }]
  const [detected, setDetected] = useState(null); // { assignment, header }
  const [result, setResult] = useState(null);

  // Globale Vorgaben, wenn die Zeile nichts angibt
  const [defCond, setDefCond] = useState("near_mint");
  const [defLang, setDefLang] = useState("de");
  const [defVariant, setDefVariant] = useState("normal");
  const [defDate, setDefDate] = useState("");

  async function preview() {
    const { rows, assignment, header } = parseImport(text);
    if (!rows.length) return;
    setDetected({ assignment, header });
    setBusy(true);
    try {
      const res = await matchImportRows(rows);
      setMatched(
        res.map((r) => ({
          ...r,
          chosen: r.best,
          include: !!r.best,
          quantity: r.input.quantity || "1",
          price: r.input.price || "",
        }))
      );
      setStep("preview");
    } finally {
      setBusy(false);
    }
  }

  const stats = useMemo(() => {
    const inc = matched.filter((m) => m.include && m.chosen);
    return { total: matched.length, matched: matched.filter((m) => m.chosen).length, selected: inc.length };
  }, [matched]);

  function setRow(i, patch) {
    setMatched((m) => m.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  async function doImport() {
    const items = matched
      .filter((m) => m.include && m.chosen)
      .map((m) => ({
        externalId: m.chosen.external_id,
        quantity: num(m.quantity) ?? 1,
        purchasePrice: num(m.price),
        shippingCost: num(m.input.shipping),
        purchaseDate: m.input.date || defDate || null,
        notes: m.input.notes || null,
        condition: normCondition(m.input.condition) ?? defCond,
        language: normLanguage(m.input.language) ?? defLang,
        variant: normVariant(m.input.variant) ?? defVariant,
      }));
    if (!items.length) return;
    setBusy(true);
    try {
      const r = await commitImport(items);
      setResult(r);
      setStep("done");
    } finally {
      setBusy(false);
    }
  }

  const selCls =
    "border border-line rounded-lg px-2 py-1 text-xs bg-canvas text-ink focus:outline-none focus:border-ink";

  if (step === "done") {
    return (
      <div className="py-16 text-center">
        <p className="text-2xl font-semibold mb-2">{result.added} Karten importiert 🎉</p>
        <p className="text-subtle mb-6">Die Preise werden im Hintergrund nachgezogen.</p>
        <Link to="/" className="inline-block bg-yellow text-yellowInk font-medium px-5 py-2.5 rounded-full">
          Zur Sammlung
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-xl font-semibold">Massen-Import</h1>
        <Link to="/add" className="text-sm text-subtle hover:text-ink">← Einzeln hinzufügen</Link>
      </div>

      {step === "input" && (
        <>
          <p className="text-subtle text-sm mb-4">
            Tabelle aus Excel kopieren und hier einfügen, oder CSV / eine Liste
            von Kartennamen (einer pro Zeile). Deutsche Namen und Kartennummern
            funktionieren.
          </p>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={12}
            placeholder={EXAMPLE}
            className="w-full border border-line rounded-xl px-3 py-2 text-sm font-mono bg-white text-[#241c15] placeholder:text-[#8a7a63] focus:outline-none focus:border-ink"
          />
          <div className="flex items-center gap-3 mt-3">
            <button
              onClick={preview}
              disabled={busy || !text.trim()}
              className="bg-yellow text-yellowInk font-medium px-5 py-2.5 rounded-full text-sm disabled:opacity-60"
            >
              {busy ? "Prüfe …" : "Vorschau"}
            </button>
            <button onClick={() => setText(EXAMPLE)} className="text-xs text-subtle underline">
              Beispiel einfügen
            </button>
          </div>
        </>
      )}

      {step === "preview" && (
        <>
          {detected && (
            <p className="text-xs text-subtle mb-3">
              Erkannt:{" "}
              {Object.entries(FIELD_LABELS)
                .filter(([f]) => detected.assignment[f] != null)
                .map(([f]) => {
                  const col = detected.assignment[f];
                  const h = detected.header?.[col];
                  return `${FIELD_LABELS[f]} = ${h ? `„${h}"` : `Spalte ${col + 1}`}`;
                })
                .join(" · ") || "einspaltige Liste (Kartennamen)"}
              . Stimmt etwas nicht, korrigier es unten pro Zeile.
            </p>
          )}
          <div className="flex flex-wrap items-center gap-4 mb-4 text-sm">
            <span className="text-subtle">
              {stats.matched} von {stats.total} zugeordnet · {stats.selected} ausgewählt
            </span>
            <span className="flex items-center gap-2">
              <span className="text-xs text-subtle">Vorgaben:</span>
              <select value={defCond} onChange={(e) => setDefCond(e.target.value)} className={selCls}>
                {CONDITIONS.map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
              <select value={defLang} onChange={(e) => setDefLang(e.target.value)} className={selCls}>
                <option value="de">Deutsch</option>
                <option value="en">Englisch</option>
              </select>
              <select value={defVariant} onChange={(e) => setDefVariant(e.target.value)} className={selCls}>
                {VARIANTS.map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
              <input
                type="date"
                value={defDate}
                onChange={(e) => setDefDate(e.target.value)}
                className={selCls}
                title="Kaufdatum (Vorgabe)"
              />
            </span>
          </div>

          <div className="border-t border-line">
            {matched.map((m, i) => (
              <div key={i} className="flex items-center gap-3 py-2.5 border-b border-line text-sm">
                <input
                  type="checkbox"
                  checked={m.include}
                  disabled={!m.chosen}
                  onChange={(e) => setRow(i, { include: e.target.checked })}
                  className="shrink-0"
                />
                <div className="w-40 shrink-0 min-w-0">
                  <p className="text-xs text-subtle truncate">{m.input.raw}</p>
                </div>
                <div className="flex-1 min-w-0">
                  {m.candidates.length > 0 ? (
                    <select
                      value={m.chosen?.external_id ?? ""}
                      onChange={(e) =>
                        setRow(i, {
                          chosen: m.candidates.find((c) => c.external_id === e.target.value) ?? null,
                          include: !!e.target.value,
                        })
                      }
                      className="w-full border border-line rounded-lg px-2 py-1 text-xs bg-canvas text-ink"
                    >
                      {m.candidates.map((c) => (
                        <option key={c.external_id} value={c.external_id}>
                          {c.name} · {c.set_name} · #{c.number}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="text-rose text-xs">nicht gefunden</span>
                  )}
                </div>
                {m.chosen && (
                  <img src={m.chosen.image_small} alt="" className="w-8 rounded shrink-0" />
                )}
                <input
                  value={m.quantity}
                  onChange={(e) => setRow(i, { quantity: e.target.value })}
                  className="w-12 border border-line rounded-lg px-1.5 py-1 text-xs bg-canvas text-ink text-center"
                  title="Menge"
                />
                <input
                  value={m.price}
                  onChange={(e) => setRow(i, { price: e.target.value })}
                  placeholder="€"
                  className="w-16 border border-line rounded-lg px-1.5 py-1 text-xs bg-canvas text-ink text-center"
                  title="Kaufpreis"
                />
              </div>
            ))}
          </div>

          <div className="flex items-center gap-3 mt-4">
            <button
              onClick={doImport}
              disabled={busy || stats.selected === 0}
              className="bg-yellow text-yellowInk font-medium px-5 py-2.5 rounded-full text-sm disabled:opacity-60"
            >
              {busy ? "Importiere …" : `${stats.selected} Karten importieren`}
            </button>
            <button onClick={() => setStep("input")} className="text-sm text-subtle underline">
              zurück
            </button>
          </div>
        </>
      )}
    </div>
  );
}
