import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { matchImportRows, commitImport, searchCards } from "../api.js";
import { parseImport, normCondition, normLanguage, normVariant } from "../lib/parseImport.js";
import { CONDITIONS, VARIANTS } from "../components/CollectionItemDialog.jsx";

const num = (v) => {
  const n = parseFloat(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
};
const eur = (n) => `${n.toFixed(2)} €`;

// Die Rohzeile aus einer breiten Tabelle (viele Spalten) kann sehr lang
// werden - hier gekürzt mit "…", voller Inhalt bleibt als Tooltip erhalten.
const shorten = (s, max = 60) => (s.length > max ? `${s.slice(0, max).trimEnd()}…` : s);

// Wenn keine automatische Zuordnung gefunden wurde: einfache Karten-Suche
// direkt in der Zeile, statt die ganze Zeile ergebnislos zu verwerfen.
function ManualCardPicker({ onPick }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState(null);
  const [busy, setBusy] = useState(false);

  async function runSearch() {
    if (!query.trim()) return;
    setBusy(true);
    try {
      setResults(await searchCards(query.trim()));
    } catch {
      setResults([]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="flex items-center gap-1">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), runSearch())}
          placeholder="Karte suchen …"
          className="w-full border border-rose rounded-lg px-1.5 py-1 text-xs bg-canvas text-ink focus:outline-none focus:border-ink"
        />
        <button
          type="button"
          onClick={runSearch}
          disabled={busy || !query.trim()}
          className="shrink-0 text-xs border border-line rounded-lg px-2 py-1 hover:border-ink disabled:opacity-50"
        >
          {busy ? "…" : "Suchen"}
        </button>
      </div>
      {results && (
        results.length ? (
          <ul className="mt-1 border border-line rounded-lg max-h-40 overflow-y-auto bg-canvas">
            {results.slice(0, 15).map((c) => (
              <li key={c.external_id}>
                <button
                  type="button"
                  onClick={() => onPick(c)}
                  className="w-full flex items-center gap-1.5 px-1.5 py-1 text-left hover:bg-surface"
                >
                  <img src={c.image_small} alt="" className="w-5 rounded shrink-0" />
                  <span className="truncate">{c.name} · {c.set_name} · #{c.number}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-subtle mt-1">keine Treffer</p>
        )
      )}
    </div>
  );
}

// Eindeutige Lang-Anzeige ("11. September 2026") direkt neben dem
// Datumsfeld - falls der Browser beim Tippen (statt Kalender-Klick) das
// Datum nach eigenem Sprachgefühl anders interpretiert als gemeint, fällt
// das hier sofort auf, statt erst später in der Sammlung.
function formatLongDate(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString("de-DE", { day: "numeric", month: "long", year: "numeric" });
}

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

const inputCls =
  "w-full border border-line rounded-lg px-1.5 py-1 text-xs bg-canvas text-ink focus:outline-none focus:border-ink";

export default function Import() {
  const navigate = useNavigate();
  const [text, setText] = useState("");
  const [step, setStep] = useState("input"); // input | preview | done
  const [busy, setBusy] = useState(false);
  const [matched, setMatched] = useState([]); // [{ input, best, candidates, chosen, include, quantity, price, shipping, condition, language, variant, date, notes }]
  const [detected, setDetected] = useState(null); // { assignment, header }
  const [result, setResult] = useState(null);
  const [importError, setImportError] = useState(null);

  // Globale Vorgaben, wenn eine Zeile nichts Eigenes einträgt - Zeilen
  // können das unten jederzeit einzeln überschreiben.
  const [defCond, setDefCond] = useState("near_mint");
  const [defLang, setDefLang] = useState("de");
  const [defVariant, setDefVariant] = useState("normal");
  const [defDate, setDefDate] = useState("");

  async function preview() {
    const { rows, assignment, header } = parseImport(text);
    if (!rows.length) return;
    setDetected({ assignment, header });
    setBusy(true);
    setImportError(null);
    try {
      const res = await matchImportRows(rows);
      setMatched(
        res.map((r) => ({
          ...r,
          chosen: r.best,
          include: !!r.best,
          quantity: r.input.quantity || "1",
          price: r.input.price || "",
          shipping: r.input.shipping || "",
          condition: normCondition(r.input.condition) || "",
          language: normLanguage(r.input.language) || "",
          variant: normVariant(r.input.variant) || "",
          date: r.input.date || "",
          notes: r.input.notes || "",
        }))
      );
      setStep("preview");
    } catch (err) {
      setImportError(err.message || "Vorschau fehlgeschlagen. Bitte nochmal versuchen.");
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
        shippingCost: num(m.shipping),
        purchaseDate: m.date || defDate || null,
        notes: m.notes || null,
        condition: m.condition || defCond,
        language: m.language || defLang,
        variant: m.variant || defVariant,
      }));
    if (!items.length) return;
    setBusy(true);
    setImportError(null);
    try {
      const r = await commitImport(items);
      setResult(r);
      setStep("done");
    } catch (err) {
      setImportError(err.message || "Import fehlgeschlagen. Bitte nochmal versuchen.");
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
        <Link to="/sets" className="text-sm text-subtle hover:text-ink">← Einzeln hinzufügen</Link>
      </div>

      {importError && (
        <p className="text-rose text-sm mt-3 bg-rose/10 border border-rose/30 rounded-xl px-3 py-2">
          {importError}
        </p>
      )}

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
              . Jede Zeile lässt sich unten einzeln zur Kontrolle korrigieren.
            </p>
          )}
          <div className="flex flex-wrap items-center gap-4 mb-4 text-sm">
            <span className="text-subtle">
              {stats.matched} von {stats.total} zugeordnet · {stats.selected} ausgewählt
            </span>
            <span className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-subtle">Vorgaben (gelten, wenn eine Zeile nichts Eigenes hat):</span>
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
              {defDate && (
                <span className="text-xs text-subtle" title="So wird das Datum verstanden - bei Tippfehlern hier prüfen">
                  → {formatLongDate(defDate)}
                </span>
              )}
            </span>
          </div>

          <div className="overflow-x-auto -mx-6 px-6">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="text-left text-subtle border-b border-line">
                  <th className="py-2 pr-2 font-normal"></th>
                  <th className="py-2 pr-2 font-normal min-w-[220px]">Karte</th>
                  <th className="py-2 pr-2 font-normal min-w-[110px]">Status</th>
                  <th className="py-2 pr-2 font-normal">Menge</th>
                  <th className="py-2 pr-2 font-normal">Kaufpreis</th>
                  <th className="py-2 pr-2 font-normal">Versand</th>
                  <th className="py-2 pr-2 font-normal">Einstand</th>
                  <th className="py-2 pr-2 font-normal">Zustand</th>
                  <th className="py-2 pr-2 font-normal">Sprache</th>
                  <th className="py-2 pr-2 font-normal">Variante</th>
                  <th className="py-2 pr-2 font-normal min-w-[130px]">Kaufdatum</th>
                  <th className="py-2 pr-2 font-normal min-w-[120px]">Notiz</th>
                </tr>
              </thead>
              <tbody>
                {matched.map((m, i) => {
                  const effDate = m.date || defDate;
                  const einstand = (num(m.price) ?? 0) + (num(m.shipping) ?? 0);
                  const einstandTotal = einstand * (num(m.quantity) ?? 1);
                  return (
                    <tr key={i} className="border-b border-line align-top">
                      <td className="py-2 pr-2">
                        <input
                          type="checkbox"
                          checked={m.include}
                          disabled={!m.chosen}
                          onChange={(e) => setRow(i, { include: e.target.checked })}
                        />
                      </td>
                      <td className="py-2 pr-2 min-w-[220px] max-w-[260px]">
                        <p className="text-subtle truncate mb-1" title={m.input.raw}>
                          {shorten(m.input.raw)}
                        </p>
                        {m.candidates.length > 0 ? (
                          <div className="flex items-center gap-1.5">
                            {m.chosen && (
                              <img src={m.chosen.image_small} alt="" className="w-6 rounded shrink-0" />
                            )}
                            <select
                              value={m.chosen?.external_id ?? ""}
                              onChange={(e) =>
                                setRow(i, {
                                  chosen: m.candidates.find((c) => c.external_id === e.target.value) ?? null,
                                  include: !!e.target.value,
                                })
                              }
                              className={`w-full border rounded-lg px-1.5 py-1 text-xs bg-canvas text-ink ${
                                m.confidence === "low" ? "border-amber-500" : "border-line"
                              }`}
                            >
                              {m.candidates.map((c) => (
                                <option key={c.external_id} value={c.external_id}>
                                  {c.name} · {c.set_name} · #{c.number}
                                </option>
                              ))}
                            </select>
                          </div>
                        ) : (
                          <div>
                            <p className="text-rose mb-1">nicht gefunden</p>
                            <ManualCardPicker
                              onPick={(c) => setRow(i, { chosen: c, candidates: [c], include: true })}
                            />
                          </div>
                        )}
                      </td>
                      <td className="py-2 pr-2 min-w-[110px]">
                        {m.confidence === "low" && (
                          <span className="inline-block bg-amber-100 text-amber-700 border border-amber-400 rounded-full px-2 py-0.5 whitespace-nowrap">
                            ⚠ Prüfungsbedarf
                          </span>
                        )}
                      </td>
                      <td className="py-2 pr-2">
                        <input
                          value={m.quantity}
                          onChange={(e) => setRow(i, { quantity: e.target.value })}
                          className={`${inputCls} w-12 text-center`}
                        />
                      </td>
                      <td className="py-2 pr-2">
                        <input
                          value={m.price}
                          onChange={(e) => setRow(i, { price: e.target.value })}
                          placeholder="€"
                          className={`${inputCls} w-16 text-center`}
                        />
                      </td>
                      <td className="py-2 pr-2">
                        <input
                          value={m.shipping}
                          onChange={(e) => setRow(i, { shipping: e.target.value })}
                          placeholder="€"
                          className={`${inputCls} w-16 text-center`}
                        />
                      </td>
                      <td className="py-2 pr-2 font-mono whitespace-nowrap">
                        {einstand > 0 ? eur(einstandTotal) : "—"}
                      </td>
                      <td className="py-2 pr-2">
                        <select
                          value={m.condition || defCond}
                          onChange={(e) => setRow(i, { condition: e.target.value })}
                          className={`${inputCls} min-w-[110px]`}
                        >
                          {CONDITIONS.map(([v, l]) => (
                            <option key={v} value={v}>{l}</option>
                          ))}
                        </select>
                      </td>
                      <td className="py-2 pr-2">
                        <select
                          value={m.language || defLang}
                          onChange={(e) => setRow(i, { language: e.target.value })}
                          className={`${inputCls} min-w-[80px]`}
                        >
                          <option value="de">Deutsch</option>
                          <option value="en">Englisch</option>
                        </select>
                      </td>
                      <td className="py-2 pr-2">
                        <select
                          value={m.variant || defVariant}
                          onChange={(e) => setRow(i, { variant: e.target.value })}
                          className={`${inputCls} min-w-[100px]`}
                        >
                          {VARIANTS.map(([v, l]) => (
                            <option key={v} value={v}>{l}</option>
                          ))}
                        </select>
                      </td>
                      <td className="py-2 pr-2 min-w-[130px]">
                        <input
                          type="date"
                          value={effDate}
                          onChange={(e) => setRow(i, { date: e.target.value })}
                          className={inputCls}
                        />
                        {effDate && (
                          <p className="text-subtle mt-0.5 whitespace-nowrap" title="So wird das Datum verstanden">
                            {formatLongDate(effDate)}
                          </p>
                        )}
                      </td>
                      <td className="py-2 pr-2 min-w-[120px]">
                        <input
                          value={m.notes}
                          onChange={(e) => setRow(i, { notes: e.target.value })}
                          placeholder="optional"
                          className={inputCls}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
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
