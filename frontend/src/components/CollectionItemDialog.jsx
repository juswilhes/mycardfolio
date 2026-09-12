import { useEffect, useState } from "react";

export const CONDITIONS = [
  ["sealed", "Sealed"],
  ["mint", "Mint"],
  ["near_mint", "Near Mint"],
  ["excellent", "Excellent"],
  ["good", "Good"],
  ["light_played", "Light Played"],
  ["played", "Played"],
  ["poor", "Poor"],
];

// inkl. alter Werte, damit früher gespeicherte Einträge lesbar bleiben
const CONDITION_LABELS = {
  ...Object.fromEntries(CONDITIONS),
  lightly_played: "Light Played",
  moderately_played: "Played",
  heavily_played: "Played",
  damaged: "Poor",
};
export const conditionLabel = (v) => CONDITION_LABELS[v] ?? v ?? "—";

export const VARIANTS = [
  ["normal", "Normal"],
  ["holo", "Holo"],
  ["reverse", "Reverse Holo"],
  ["first_edition", "1st Edition"],
];
const VARIANT_LABELS = Object.fromEntries(VARIANTS);
export const variantLabel = (v) => VARIANT_LABELS[v] ?? "Normal";

// Kurzkürzel für die Sprache, wie es in jeder Sammlungszeile steht.
const LANG_LABELS = {
  de: "DE",
  en: "ENG",
  fr: "FR",
  it: "IT",
  es: "ES",
  pt: "PT",
  ja: "JP",
  jp: "JP",
  ko: "KR",
  "zh-cn": "CN",
  "zh-tw": "TW",
  ru: "RU",
  nl: "NL",
};
export const langLabel = (v) => {
  if (!v) return null;
  const k = String(v).toLowerCase();
  return LANG_LABELS[k] ?? k.slice(0, 3).toUpperCase();
};

// Bekannte Grading-Firmen. Wert = Kürzel (so gespeichert), Label = Anzeige.
export const GRADERS = [
  ["PSA", "PSA"],
  ["BGS", "BGS (Beckett)"],
  ["CGC", "CGC"],
  ["SGC", "SGC"],
  ["AGS", "AGS"],
  ["TAG", "TAG"],
  ["ACE", "ACE Grading"],
  ["GG", "GG (Getgraded)"],
  ["Andere", "Andere"],
];
export const gradeLabel = (company, grade) => {
  if (!company) return null;
  return grade ? `${company} ${grade}` : company;
};

const today = () => new Date().toISOString().slice(0, 10);

const emptyLot = (date) => ({ quantity: "1", purchasePrice: "", shippingCost: "", purchaseDate: date });
const round2 = (n) => Math.round(n * 100) / 100;

// Dialog zum Erfassen ODER Bearbeiten eines Sammlungs-Eintrags.
// Beim NEU-Hinzufügen (kein initial) können mehrere "Käufe" derselben
// Karte auf einmal erfasst werden (z.B. 3 Stück von Verkäufer A zu 5 €,
// 2 Stück von Verkäufer B zu 7 €) - beim Bearbeiten eines bestehenden
// Eintrags (initial gesetzt) bleibt es bei einem einzelnen Kauf.
// onConfirm bekommt beim Bearbeiten weiter die reinen Formularwerte,
// beim Hinzufügen zusätzlich ein "lots"-Array; der aufrufende Screen
// hängt ggf. externalId an und kümmert sich um API-Call(s) + Animation.
export default function CollectionItemDialog({
  card,
  initial,
  title = "Zum Portfolio hinzufügen",
  submitLabel = "Zum Portfolio",
  busy,
  error,
  onConfirm,
  onClose,
}) {
  const editing = !!initial;
  const [form, setForm] = useState({
    condition: initial?.condition ?? "near_mint",
    variant: initial?.variant ?? "normal",
    language: initial?.language ?? "de",
    notes: initial?.notes ?? "",
    gradingCompany: initial?.grading_company ?? "",
    grade: initial?.grade ?? "",
  });
  const [lots, setLots] = useState([
    editing
      ? {
          quantity: String(initial?.quantity ?? 1),
          // Gespeichert wird pro Karte, eingegeben/angezeigt wird der
          // Gesamtpreis dieses Kaufs (siehe submit()/lotTotal() unten).
          purchasePrice:
            initial?.purchase_price != null
              ? String(round2(initial.purchase_price * (initial?.quantity ?? 1)))
              : "",
          shippingCost:
            initial?.shipping_cost != null
              ? String(round2(initial.shipping_cost * (initial?.quantity ?? 1)))
              : "",
          purchaseDate: initial?.purchase_date ? initial.purchase_date.slice(0, 10) : today(),
        }
      : emptyLot(today()),
  ]);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const setLot = (i, k) => (e) =>
    setLots((ls) => ls.map((l, idx) => (idx === i ? { ...l, [k]: e.target.value } : l)));
  const addLot = () => setLots((ls) => [...ls, emptyLot(ls[ls.length - 1]?.purchaseDate || today())]);
  const removeLot = (i) => setLots((ls) => ls.filter((_, idx) => idx !== i));

  // Menge/Kaufpreis/Versand werden pro Kauf als GESAMTSUMME eingegeben (z.B.
  // "3 Stück für 15 €" statt selbst durch 3 teilen zu müssen) - gespeichert
  // wird trotzdem pro Karte, weil die Sammlung überall (Summen, Gewinn/
  // Verlust) mit Preis-pro-Stück × Menge rechnet.
  const lotTotal = (l) => (parseFloat(l.purchasePrice) || 0) + (parseFloat(l.shippingCost) || 0);
  const total = lots.reduce((sum, l) => sum + lotTotal(l), 0);

  function lotToPayload(l) {
    const quantity = parseInt(l.quantity, 10) || 1;
    return {
      quantity,
      purchasePrice: l.purchasePrice === "" ? null : round2((parseFloat(l.purchasePrice) || 0) / quantity),
      shippingCost: l.shippingCost === "" ? null : round2((parseFloat(l.shippingCost) || 0) / quantity),
      purchaseDate: l.purchaseDate || null,
    };
  }

  function submit(e) {
    e.preventDefault();
    if (busy) return;
    const shared = {
      condition: form.condition,
      variant: form.variant,
      language: form.language,
      notes: form.notes.trim() || null,
      gradingCompany: form.gradingCompany || null,
      grade: form.gradingCompany ? form.grade.trim() || null : null,
    };
    if (editing) {
      onConfirm({ ...shared, ...lotToPayload(lots[0]) });
    } else {
      onConfirm({ ...shared, lots: lots.map(lotToPayload) });
    }
  }

  const showGrading = form.condition === "mint" || !!form.gradingCompany;

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-ink/40 backdrop-blur-sm"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <form
        onSubmit={submit}
        className="w-full max-w-md max-h-[85vh] overflow-y-auto bg-surface border border-line rounded-3xl p-6 shadow-xl"
      >
        <div className="flex gap-4 mb-5">
          <img
            src={card.image_small ?? card.image_large}
            alt=""
            className="w-16 rounded-lg border border-line shrink-0"
          />
          <div className="min-w-0">
            <p className="text-xs text-subtle">{title}</p>
            <p className="font-semibold truncate">{card.name}</p>
            <p className="text-subtle text-xs truncate">
              {card.set_name}
              {card.number ? ` · #${card.number}` : ""}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="text-xs text-subtle col-span-2">
            Zustand
            <select
              value={form.condition} onChange={set("condition")}
              className="mt-1 w-full border border-line rounded-xl px-3 py-2 text-sm text-ink bg-canvas focus:outline-none focus:border-ink"
            >
              {CONDITIONS.map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </label>
          <label className="text-xs text-subtle col-span-2">
            Variante
            <select
              value={form.variant} onChange={set("variant")}
              className="mt-1 w-full border border-line rounded-xl px-3 py-2 text-sm text-ink bg-canvas focus:outline-none focus:border-ink"
            >
              {VARIANTS.map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </label>
          {showGrading && (
            <div className="col-span-2 rounded-xl border border-line bg-canvas/50 p-3">
              <p className="text-xs font-medium text-ink mb-2">
                Wurde die Karte gegradet?
              </p>
              <div className="grid grid-cols-2 gap-3">
                <label className="text-xs text-subtle">
                  Grading-Firma
                  <select
                    value={form.gradingCompany}
                    onChange={set("gradingCompany")}
                    className="mt-1 w-full border border-line rounded-xl px-3 py-2 text-sm text-ink bg-canvas focus:outline-none focus:border-ink"
                  >
                    <option value="">Nein, Rohkarte</option>
                    {GRADERS.map(([v, l]) => (
                      <option key={v} value={v}>{l}</option>
                    ))}
                  </select>
                </label>
                {form.gradingCompany && (
                  <label className="text-xs text-subtle">
                    Note (z. B. 10, 9.5)
                    <input
                      type="text"
                      value={form.grade}
                      onChange={set("grade")}
                      placeholder="Grade"
                      className="mt-1 w-full border border-line rounded-xl px-3 py-2 text-sm text-ink bg-canvas focus:outline-none focus:border-ink"
                    />
                  </label>
                )}
              </div>
            </div>
          )}
          <label className="text-xs text-subtle col-span-2">
            Sprache der Karte
            <select
              value={form.language} onChange={set("language")}
              className="mt-1 w-full border border-line rounded-xl px-3 py-2 text-sm text-ink bg-canvas focus:outline-none focus:border-ink"
            >
              <option value="de">Deutsch</option>
              <option value="en">Englisch</option>
            </select>
          </label>
          <div className="col-span-2 space-y-3">
            {lots.map((lot, i) => (
              <div key={i} className="rounded-xl border border-line p-3">
                {lots.length > 1 && (
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-medium text-subtle">Kauf {i + 1}</p>
                    <button
                      type="button"
                      onClick={() => removeLot(i)}
                      className="text-xs text-subtle hover:text-rose"
                    >
                      entfernen
                    </button>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <label className="text-xs text-subtle">
                    Menge
                    <input
                      type="number" min="1" value={lot.quantity} onChange={setLot(i, "quantity")}
                      className="mt-1 w-full border border-line rounded-xl px-3 py-2 text-sm text-ink bg-canvas focus:outline-none focus:border-ink"
                    />
                  </label>
                  <label className="text-xs text-subtle">
                    Kaufpreis (€) gesamt
                    <input
                      type="number" min="0" step="0.01" inputMode="decimal" placeholder="0,00"
                      value={lot.purchasePrice} onChange={setLot(i, "purchasePrice")}
                      className="mt-1 w-full border border-line rounded-xl px-3 py-2 text-sm text-ink bg-canvas focus:outline-none focus:border-ink"
                    />
                    {(parseInt(lot.quantity, 10) || 1) > 1 && lot.purchasePrice !== "" && (
                      <span className="block mt-0.5 text-[11px] text-subtle">
                        = {round2((parseFloat(lot.purchasePrice) || 0) / (parseInt(lot.quantity, 10) || 1)).toFixed(2)} € / Stück
                      </span>
                    )}
                  </label>
                  <label className="text-xs text-subtle">
                    Versand (€) gesamt
                    <input
                      type="number" min="0" step="0.01" inputMode="decimal" placeholder="0,00"
                      value={lot.shippingCost} onChange={setLot(i, "shippingCost")}
                      className="mt-1 w-full border border-line rounded-xl px-3 py-2 text-sm text-ink bg-canvas focus:outline-none focus:border-ink"
                    />
                  </label>
                  <label className="text-xs text-subtle">
                    Kaufdatum
                    <input
                      type="date" value={lot.purchaseDate} onChange={setLot(i, "purchaseDate")}
                      className="mt-1 w-full border border-line rounded-xl px-3 py-2 text-sm text-ink bg-canvas focus:outline-none focus:border-ink"
                    />
                  </label>
                </div>
              </div>
            ))}
            {!editing && (
              <button
                type="button"
                onClick={addLot}
                className="text-xs text-ink underline"
              >
                + Weiterer Kauf (z. B. anderer Verkäufer/Preis)
              </button>
            )}
          </div>
          <label className="text-xs text-subtle col-span-2">
            Notiz (optional)
            <input
              type="text" value={form.notes} onChange={set("notes")}
              placeholder="z. B. gekauft bei …"
              className="mt-1 w-full border border-line rounded-xl px-3 py-2 text-sm text-ink bg-canvas focus:outline-none focus:border-ink"
            />
          </label>
        </div>

        <div className="flex items-center justify-between mt-5 mb-4 text-sm">
          <span className="text-subtle">Einstandswert gesamt</span>
          <span className="font-mono font-medium">{total.toFixed(2)} €</span>
        </div>

        {error && (
          <p className="text-rose text-sm mb-4 bg-rose/10 border border-rose/30 rounded-xl px-3 py-2">
            {error}
          </p>
        )}

        <div className="flex gap-2">
          <button
            type="button" onClick={onClose}
            className="flex-1 border border-line rounded-full py-2.5 text-sm hover:border-ink"
          >
            Abbrechen
          </button>
          <button
            type="submit" disabled={busy}
            className="flex-1 bg-yellow text-yellowInk font-medium rounded-full py-2.5 text-sm disabled:opacity-60"
          >
            {busy ? "Speichern …" : submitLabel}
          </button>
        </div>
      </form>
    </div>
  );
}
