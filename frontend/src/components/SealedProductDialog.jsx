import { useEffect, useState } from "react";
import { getSealedCatalog } from "../api.js";
import { eur } from "../lib/format.js";

const today = () => new Date().toISOString().slice(0, 10);
const round2 = (n) => Math.round(n * 100) / 100;

// Sprachen für Sealed-Produkte (Justus 09.11.2026); Kürzel wie in der Datenbank
export const SEALED_LANGUAGES = [
  ["de", "Deutsch"],
  ["en", "Englisch"],
  ["ja", "Japanisch"],
  ["fr", "Französisch"],
  ["it", "Italienisch"],
  ["es", "Spanisch"],
];

// Dialog zum Erfassen ODER Bearbeiten eines Sealed-Produkts (Booster-Display,
// Elite Trainer Box, Bundle, ...). Beim Hinzufügen auf der Set-Seite steht oben
// die Auswahl aus dem Katalog des Sets (Bild + aktueller Wert, jede Nacht neu,
// backend/src/services/sealedCatalog.js); ein eigener Wert geht vor. Produkte, die
// nicht im Katalog stehen, lassen sich weiter von Hand eintragen.
export default function SealedProductDialog({
  setId,
  preset, // Katalog-Produkt, das schon gewählt ist ("+" in der Sealed-Liste der Set-Seite)
  setName,
  initial,
  busy,
  error,
  onConfirm,
  onClose,
}) {
  const editing = !!initial;
  const [catalog, setCatalog] = useState(null);
  const [catalogId, setCatalogId] = useState(initial?.catalog_id ?? preset?.id ?? null);
  const [autoValue, setAutoValue] = useState(initial?.auto_value ?? (preset?.priceCents != null ? preset.priceCents / 100 : null));
  const [name, setName2] = useState(initial?.name ?? preset?.name ?? "");
  // Bild des gewählten Katalog-Produkts - nur für die Animation nach dem Hinzufügen (2. Argument von onConfirm)
  const [chosenImage, setChosenImage] = useState(preset?.image ?? null);
  const [language, setLanguage] = useState(initial?.language ?? "de");
  const [quantity, setQuantity] = useState(String(initial?.quantity ?? 1));
  // Gesamtpreis für diesen Kauf, wie beim Karten-Dialog - nicht pro Stück,
  // damit niemand selbst durch die Menge teilen muss.
  const [purchasePrice, setPurchasePrice] = useState(
    initial?.purchase_price != null ? String(round2(initial.purchase_price * (initial?.quantity ?? 1))) : ""
  );
  const [shippingCost, setShippingCost] = useState(
    initial?.shipping_cost != null ? String(round2(initial.shipping_cost * (initial?.quantity ?? 1))) : ""
  );
  const [purchaseDate, setPurchaseDate] = useState(
    initial?.purchase_date ? initial.purchase_date.slice(0, 10) : today()
  );
  const [currentValue, setCurrentValue] = useState(
    initial?.current_value != null ? String(initial.current_value) : ""
  );
  const [imageUrl, setImageUrl] = useState(initial?.image_url ?? "");
  const [cardmarketUrl, setCardmarketUrl] = useState(initial?.cardmarket_url ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    if (editing || !setId || preset) return;
    getSealedCatalog(setId)
      .then(setCatalog)
      .catch(() => setCatalog([]));
  }, [editing, setId]);

  function choose(item) {
    setCatalogId(item?.id ?? null);
    setAutoValue(item?.priceCents != null ? item.priceCents / 100 : null);
    setName2(item?.name ?? "");
    setChosenImage(item?.image ?? null);
    setImageUrl("");
    setCardmarketUrl("");
  }

  // "Delta Reign Elite Trainer Box" -> "Elite Trainer Box" (der Set-Name steht schon oben)
  const short = (n) => (setName && n.startsWith(`${setName} `) ? n.slice(setName.length + 1) : n);

  const qty = parseInt(quantity, 10) || 1;
  const totalPaid = (parseFloat(purchasePrice) || 0) + (parseFloat(shippingCost) || 0);

  function submit(e) {
    e.preventDefault();
    if (busy || !name.trim()) return;
    onConfirm({
      name: name.trim(),
      quantity: qty,
      purchasePrice: purchasePrice === "" ? null : round2((parseFloat(purchasePrice) || 0) / qty),
      shippingCost: shippingCost === "" ? null : round2((parseFloat(shippingCost) || 0) / qty),
      purchaseDate: purchaseDate || null,
      currentValue: currentValue === "" ? null : parseFloat(currentValue) || 0,
      imageUrl: catalogId ? null : imageUrl.trim() || null,
      cardmarketUrl: catalogId ? null : cardmarketUrl.trim() || null,
      notes: notes.trim() || null,
      catalogId,
      language,
    }, { image: catalogId ? chosenImage : imageUrl.trim() || null });
  }

  const inputCls =
    "mt-1 w-full border border-line rounded-xl px-3 py-2 text-sm text-ink bg-canvas focus:outline-none focus:border-ink";

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-ink/40 backdrop-blur-sm"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <form
        onSubmit={submit}
        className="w-full max-w-md max-h-[85vh] overflow-y-auto bg-surface border border-line rounded-3xl p-6 shadow-xl"
      >
        <p className="text-xs text-subtle mb-1">
          {editing ? "Sealed-Produkt bearbeiten" : "Sealed-Produkt hinzufügen"}
        </p>
        {setName && <p className="font-semibold mb-4 truncate">{setName}</p>}

        {/* Schon bewusst gewählt ("+" oder Produktseite): keine zweite Auswahl, nur das Produkt zeigen (Justus 09.11.2026) */}
        {preset && (
          <div className="flex items-center gap-3 mb-5 rounded-xl border border-line bg-canvas p-2">
            {preset.image ? (
              <img src={preset.image} alt="" className="h-16 w-14 object-contain shrink-0" />
            ) : (
              <span className="h-16 w-14 shrink-0" />
            )}
            <span className="min-w-0">
              <span className="block text-sm font-medium leading-tight">{short(preset.name)}</span>
              <span className="block text-xs font-mono mt-1">{preset.priceCents != null ? eur(preset.priceCents / 100) : "—"}</span>
            </span>
          </div>
        )}
        {catalog === null && !editing && !preset && setId && <p className="text-xs text-subtle mb-4">Lade Produkte …</p>}
        {!preset && catalog?.length > 0 && (
          <div className="mb-5">
            <p className="text-xs text-subtle mb-2">Produkt auswählen</p>
            <div className="grid grid-cols-3 gap-2 max-h-64 overflow-y-auto pr-1">
              {catalog.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => choose(item)}
                  className={`rounded-xl border p-2 text-left flex flex-col gap-1 bg-canvas hover:border-ink ${
                    catalogId === item.id ? "border-ink ring-1 ring-ink" : "border-line"
                  }`}
                >
                  {item.image ? (
                    <img src={item.image} alt="" loading="lazy" className="h-16 w-full object-contain" />
                  ) : (
                    <span className="h-16" />
                  )}
                  <span className="text-[11px] leading-tight line-clamp-2">{short(item.name)}</span>
                  <span className="text-xs font-mono">{item.priceCents != null ? eur(item.priceCents / 100) : "—"}</span>
                </button>
              ))}
              <button
                type="button"
                onClick={() => choose(null)}
                className={`rounded-xl border p-2 text-[11px] text-subtle bg-canvas hover:border-ink ${
                  catalogId == null ? "border-ink ring-1 ring-ink" : "border-line"
                }`}
              >
                Anderes Produkt selbst eintragen
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          {!preset && (
            <label className="text-xs text-subtle col-span-2">
              Name
              <input
                type="text" value={name} onChange={(e) => setName2(e.target.value)}
                placeholder="z. B. Elite Trainer Box"
                autoFocus
                className={inputCls}
              />
            </label>
          )}
          <label className="text-xs text-subtle col-span-2">
            Sprache
            <select value={language} onChange={(e) => setLanguage(e.target.value)} className={inputCls}>
              {SEALED_LANGUAGES.map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-subtle">
            Menge
            <input
              type="number" min="1" value={quantity} onChange={(e) => setQuantity(e.target.value)}
              className={inputCls}
            />
          </label>
          <label className="text-xs text-subtle">
            Kaufdatum
            <input
              type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)}
              className={inputCls}
            />
          </label>
          <label className="text-xs text-subtle">
            Kaufpreis (€) gesamt
            <input
              type="number" min="0" step="0.01" inputMode="decimal" placeholder="0,00"
              value={purchasePrice} onChange={(e) => setPurchasePrice(e.target.value)}
              className={inputCls}
            />
            {qty > 1 && purchasePrice !== "" && (
              <span className="block mt-0.5 text-[11px] text-subtle">
                = {round2((parseFloat(purchasePrice) || 0) / qty).toFixed(2)} € / Stück
              </span>
            )}
          </label>
          <label className="text-xs text-subtle">
            Versand (€) gesamt
            <input
              type="number" min="0" step="0.01" inputMode="decimal" placeholder="0,00"
              value={shippingCost} onChange={(e) => setShippingCost(e.target.value)}
              className={inputCls}
            />
          </label>
          <label className="text-xs text-subtle col-span-2">
            {catalogId ? "Eigener Wert (€) pro Stück" : "Aktueller Wert (€) pro Stück"}
            <input
              type="number" min="0" step="0.01" inputMode="decimal"
              placeholder={catalogId && autoValue != null ? autoValue.toFixed(2) : "optional"}
              value={currentValue} onChange={(e) => setCurrentValue(e.target.value)}
              className={inputCls}
            />
            <span className="block mt-0.5 text-[11px] text-subtle">
              {catalogId
                ? `Leer lassen: der Wert${autoValue != null ? ` (aktuell ${eur(autoValue)})` : ""} wird jede Nacht automatisch aktualisiert.`
                : "Trag deine eigene Einschätzung ein, jederzeit änderbar."}
            </span>
          </label>
          {!catalogId && (
            <>
              <label className="text-xs text-subtle col-span-2">
                Bild-URL (optional)
                <input
                  type="url" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="https://…"
                  className={inputCls}
                />
              </label>
              <label className="text-xs text-subtle col-span-2">
                Cardmarket-Link (optional)
                <input
                  type="url" value={cardmarketUrl} onChange={(e) => setCardmarketUrl(e.target.value)}
                  placeholder="https://www.cardmarket.com/…"
                  className={inputCls}
                />
                <span className="block mt-0.5 text-[11px] text-subtle">
                  Link zur Produktseite bei Cardmarket - dort siehst du den aktuellen Marktpreis.
                </span>
              </label>
            </>
          )}
          <label className="text-xs text-subtle col-span-2">
            Notiz (optional)
            <input
              type="text" value={notes} onChange={(e) => setNotes(e.target.value)}
              placeholder="z. B. gekauft bei …"
              className={inputCls}
            />
          </label>
        </div>

        <div className="flex items-center justify-between mt-5 mb-4 text-sm">
          <span className="text-subtle">Einstand gesamt</span>
          <span className="font-mono font-medium">{totalPaid.toFixed(2)} €</span>
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
            type="submit" disabled={busy || !name.trim()}
            className="flex-1 bg-yellow text-yellowInk font-medium rounded-full py-2.5 text-sm disabled:opacity-60"
          >
            {busy ? "Speichern …" : editing ? "Speichern" : "Hinzufügen"}
          </button>
        </div>
      </form>
    </div>
  );
}
