import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { getSet, getCardsForSet, getOwnedInSet, getWatchlistIds, addSealedProduct, updateSetPrices, getPullRates, updatePullRates } from "../api.js";
import { useAuth } from "../context/AuthContext.jsx";
import WatchlistHeart from "../components/WatchlistHeart.jsx";
import SealedProductDialog from "../components/SealedProductDialog.jsx";

const eur = (n) => `${Number(n).toFixed(2)} €`;

const SORTS = {
  number: "Nummer",
  popularity: "Beliebtheit",
  price_desc: "Preis (hoch → niedrig)",
  price_asc: "Preis (niedrig → hoch)",
};

// Route: /sets/:setId  – frei zugänglich. Angemeldet sind Karten, die du
// besitzt, hervorgehoben; ein Filter zeigt wahlweise nur besessene oder
// nur fehlende. Ohne Konto einfach die Kartenübersicht des Sets.
export default function SetDetail() {
  const { user } = useAuth();
  const { setId } = useParams();
  const [set, setSet] = useState(null);
  const [cards, setCards] = useState(null);
  const [owned, setOwned] = useState(new Set());
  const [watchedIds, setWatchedIds] = useState(new Set());
  const [filter, setFilter] = useState("all"); // all | have | missing
  const [sort, setSort] = useState("number");
  const [sealedOpen, setSealedOpen] = useState(false);
  const [sealedBusy, setSealedBusy] = useState(false);
  const [sealedError, setSealedError] = useState(null);
  const [sealedAdded, setSealedAdded] = useState(false);

  useEffect(() => {
    getSet(setId).then(setSet);
    if (user) {
      getOwnedInSet(setId).then((ids) => setOwned(new Set(ids))).catch(() => setOwned(new Set()));
      getWatchlistIds().then((ids) => setWatchedIds(new Set(ids))).catch(() => {});
    } else {
      setOwned(new Set());
      setWatchedIds(new Set());
    }

    // Fehlende Preise werden serverseitig im Hintergrund nachgeladen (siehe
    // backfillSetPrices) - ein paar Mal automatisch neu laden, damit sie
    // ohne manuelles Neuladen der Seite nach und nach auftauchen.
    let cancelled = false;
    const delays = [0, 4000, 12000, 25000];
    const timers = delays.map((ms) =>
      setTimeout(() => {
        if (cancelled) return;
        getCardsForSet(setId).then((data) => !cancelled && setCards(data));
      }, ms)
    );
    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, [setId, user]);

  const shown = useMemo(() => {
    if (!cards) return [];
    let list = cards;
    if (filter === "have") list = list.filter((c) => owned.has(c.external_id));
    else if (filter === "missing") list = list.filter((c) => !owned.has(c.external_id));

    const cmp = {
      number: (a, b) => (a.number ?? "").localeCompare(b.number ?? "", undefined, { numeric: true }),
      popularity: (a, b) => (b.view_count ?? 0) - (a.view_count ?? 0),
      price_desc: (a, b) => (b.price ?? -1) - (a.price ?? -1),
      price_asc: (a, b) => {
        // Karten ohne Preis ans Ende, nicht künstlich als "billigste" vorne
        if (a.price == null) return 1;
        if (b.price == null) return -1;
        return a.price - b.price;
      },
    }[sort];
    return [...list].sort(cmp);
  }, [cards, owned, filter, sort]);

  const total = cards?.length ?? 0;
  const have = cards ? cards.filter((c) => owned.has(c.external_id)).length : 0;

  const top20 = useMemo(() => {
    if (!cards) return [];
    return [...cards]
      .filter((c) => c.price != null)
      .sort((a, b) => b.price - a.price)
      .slice(0, 20);
  }, [cards]);
  const top20Value = top20.reduce((s, c) => s + c.price, 0);

  const rarityList = useMemo(() => {
    if (!cards) return [];
    return [...new Set(cards.map((c) => c.rarity).filter(Boolean))];
  }, [cards]);

  async function confirmSealed(values) {
    setSealedBusy(true);
    setSealedError(null);
    try {
      await addSealedProduct({ ...values, setId, setName: set?.name });
      setSealedOpen(false);
      setSealedAdded(true);
      setTimeout(() => setSealedAdded(false), 3000);
    } catch (err) {
      setSealedError(err.message || "Speichern fehlgeschlagen. Bitte nochmal versuchen.");
    } finally {
      setSealedBusy(false);
    }
  }

  const btn = (v, label) => (
    <button
      onClick={() => setFilter(v)}
      className={`text-xs px-3 py-1.5 rounded-full border ${
        filter === v ? "border-ink text-ink" : "border-line text-subtle hover:border-ink"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div>
      <Link to="/sets" className="text-sm text-subtle hover:text-ink">← Alle Sets</Link>

      {set && (
        <div className="flex items-center gap-4 mt-4 mb-4">
          {(set.logo || set.symbol) && (
            <img src={set.logo ?? set.symbol} alt={set.name} className="h-10 object-contain" />
          )}
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold">{set.name}</h1>
            <p className="text-subtle text-xs">
              {set.series} · {set.total} Karten
              {set.release_date ? ` · veröffentlicht ${set.release_date}` : ""}
            </p>
          </div>
          {user && (
            <button
              onClick={() => setSealedOpen(true)}
              className="shrink-0 text-xs border border-line rounded-full px-3 py-1.5 hover:border-ink"
            >
              📦 Sealed-Produkt hinzufügen
            </button>
          )}
        </div>
      )}
      {sealedAdded && (
        <p className="text-mint text-xs mb-4">
          Hinzugefügt – in deiner{" "}
          <Link to="/" className="underline">Sammlung</Link> sichtbar.
        </p>
      )}

      {set && (
        <BoxValueSection
          set={set}
          top20Value={top20Value}
          top20Count={top20.length}
          canEdit={!!user?.is_operator}
          onSaved={(prices) => setSet((s) => ({ ...s, ...prices }))}
        />
      )}

      {set && cards && (
        <PullRatesSection setId={setId} rarities={rarityList} canEdit={!!user?.is_operator} />
      )}

      {cards && user && (
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <p className="text-sm font-medium">
              Du hast <span className="font-mono">{have}</span> von{" "}
              <span className="font-mono">{total}</span>
            </p>
            <div className="flex-1 h-2 rounded-full bg-line overflow-hidden max-w-xs">
              <div
                className="h-full bg-yellow"
                style={{ width: total ? `${(have / total) * 100}%` : 0 }}
              />
            </div>
          </div>
          <div className="flex gap-2">
            {btn("all", `Alle (${total})`)}
            {btn("have", `Hab ich (${have})`)}
            {btn("missing", `Fehlt mir (${total - have})`)}
          </div>
        </div>
      )}
      {cards && !user && (
        <p className="text-subtle text-sm mb-6">
          {total} Karten in diesem Set.{" "}
          <Link to="/register" className="underline hover:text-ink">
            Anmelden
          </Link>
          , um deinen Sammlungsfortschritt zu sehen.
        </p>
      )}

      {cards && (
        <div className="flex items-center gap-1.5 mb-4">
          <span className="text-xs text-subtle">Sortieren:</span>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="border border-line rounded-full px-3 py-1.5 text-xs bg-canvas text-ink focus:outline-none focus:border-ink"
          >
            {Object.entries(SORTS).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </div>
      )}

      {cards === null ? (
        <p className="text-subtle text-sm">Lade Karten …</p>
      ) : shown.length === 0 ? (
        <p className="text-subtle text-sm">Keine Karte in dieser Ansicht.</p>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-4">
          {shown.map((card) => {
            const has = owned.has(card.external_id);
            return (
              <Link
                key={card.external_id}
                to={`/database/${card.external_id}`}
                className="flex flex-col"
              >
                <div className="relative">
                  <img
                    src={card.image_small}
                    alt={`${card.name} (Englisch)`}
                    className={`rounded-2xl border mb-1.5 shadow-sm transition ${
                      has ? "border-mint" : "border-line opacity-60"
                    }`}
                  />
                  {has && (
                    <span className="absolute top-1 right-1 bg-mint text-white text-[10px] rounded-full w-5 h-5 flex items-center justify-center shadow">
                      ✓
                    </span>
                  )}
                  {user && !has && (
                    <WatchlistHeart
                      externalId={card.external_id}
                      watched={watchedIds.has(card.external_id)}
                      onChange={(now) =>
                        setWatchedIds((prev) => {
                          const next = new Set(prev);
                          now ? next.add(card.external_id) : next.delete(card.external_id);
                          return next;
                        })
                      }
                      className="absolute top-1 right-1 bg-canvas/90 rounded-full w-6 h-6 flex items-center justify-center text-base shadow"
                    />
                  )}
                </div>
                <p className="text-xs font-medium truncate">{card.name}</p>
                <div className="flex items-center justify-between">
                  <p className="text-[11px] text-subtle">#{card.number}</p>
                  <p className="text-[11px] font-mono">{card.price != null ? eur(card.price) : "—"}</p>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {top20.length > 0 && (
        <div className="mt-10">
          <h2 className="text-sm font-medium mb-3">💎 Top 20 teuerste Karten im Set</h2>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-4">
            {top20.map((card) => (
              <Link key={card.external_id} to={`/database/${card.external_id}`} className="flex flex-col">
                <img
                  src={card.image_small}
                  alt={`${card.name} (Englisch)`}
                  className="rounded-2xl border border-line mb-1.5 shadow-sm"
                />
                <p className="text-xs font-medium truncate">{card.name}</p>
                <p className="text-[11px] font-mono text-subtle">{eur(card.price)}</p>
              </Link>
            ))}
          </div>
        </div>
      )}

      {sealedOpen && (
        <SealedProductDialog
          setName={set?.name}
          busy={sealedBusy}
          error={sealedError}
          onConfirm={confirmSealed}
          onClose={() => !sealedBusy && (setSealedOpen(false), setSealedError(null))}
        />
      )}
    </div>
  );
}

// Box- und Boosterpreis (nur Betreiber editierbar, keine freie API-Quelle
// dafür) + Vergleich mit dem Wert der 20 teuersten Karten im Set. Sondersets
// ohne Display (30th Celebration, Black Bolt, ...) haben nur einen Booster-
// preis - deshalb beides optional.
function BoxValueSection({ set, top20Value, top20Count, canEdit, onSaved }) {
  const centsToInput = (c) => (c != null ? (c / 100).toFixed(2) : "");
  const [editing, setEditing] = useState(false);
  const [box, setBox] = useState(centsToInput(set.box_price_cents));
  const [booster, setBooster] = useState(centsToInput(set.booster_price_cents));
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const res = await updateSetPrices(set.id, {
        boxEur: box.trim() || null,
        boosterEur: booster.trim() || null,
      });
      onSaved({ box_price_cents: res.box_price_cents, booster_price_cents: res.booster_price_cents });
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  const boxEur = set.box_price_cents != null ? set.box_price_cents / 100 : null;
  const boosterEur = set.booster_price_cents != null ? set.booster_price_cents / 100 : null;
  const boxRatio = boxEur && top20Count ? (top20Value / boxEur) * 100 : null;
  const boosterRatio = boosterEur && top20Count ? top20Value / boosterEur : null;

  if (!canEdit && boxEur == null && boosterEur == null) return null;

  const field = (label, value, setValue, placeholder) => (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-subtle w-24">{label}</span>
      <input
        type="number"
        step="0.01"
        min="0"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && save()}
        placeholder={placeholder}
        className="border border-line rounded-full px-3 py-1 text-sm bg-canvas w-28 focus:outline-none focus:border-ink"
      />
      <span className="text-subtle">€</span>
    </label>
  );

  return (
    <div className="bg-surface border border-line rounded-2xl px-5 py-4 shadow-sm mb-6">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-medium">📦 Display &amp; Booster</p>
        {canEdit && !editing && (
          <button onClick={() => setEditing(true)} className="text-xs text-subtle hover:text-ink underline">
            {boxEur != null || boosterEur != null ? "ändern" : "eintragen"}
          </button>
        )}
      </div>
      {editing ? (
        <div className="space-y-2">
          {field("Boxpreis", box, setBox, "leer bei Sets ohne Display")}
          {field("Boosterpreis", booster, setBooster, "z. B. 4.90")}
          <div className="flex gap-2 pt-1">
            <button
              onClick={save}
              disabled={saving}
              className="text-sm bg-yellow text-yellowInk px-3 py-1 rounded-full disabled:opacity-60"
            >
              {saving ? "…" : "Speichern"}
            </button>
            <button onClick={() => setEditing(false)} className="text-sm text-subtle">
              Abbrechen
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
          <p>
            <span className="text-subtle">Boxpreis: </span>
            {boxEur != null ? (
              <span className="font-mono">{eur(boxEur)}</span>
            ) : (
              <span className="text-subtle">kein Display</span>
            )}
          </p>
          <p>
            <span className="text-subtle">Boosterpreis: </span>
            {boosterEur != null ? (
              <span className="font-mono">{eur(boosterEur)}</span>
            ) : (
              <span className="text-subtle">nicht hinterlegt</span>
            )}
          </p>
          {top20Count > 0 && (
            <p>
              <span className="text-subtle">Top {top20Count} Karten zusammen: </span>
              <span className="font-mono">{eur(top20Value)}</span>
            </p>
          )}
          {boxRatio != null && (
            <p>
              <span className="font-mono">{boxRatio.toFixed(0)} %</span>
              <span className="text-subtle"> des Boxpreises</span>
            </p>
          )}
          {boosterRatio != null && (
            <p>
              <span className="text-subtle">entspricht </span>
              <span className="font-mono">{boosterRatio.toFixed(1)}</span>
              <span className="text-subtle"> Boostern</span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// Pull Rates (nur Betreiber editierbar, keine freie API-Quelle dafür - Hand-
// Eingabe aus Booster-Auswertungen). "any" = 1 von X Packs enthält
// IRGENDEINE Karte dieser Seltenheit, "specific" = 1 von X Packs enthält
// GENAU DIESE eine Karte (das ist der Wert, der auf der Kartenseite steht).
function PullRatesSection({ setId, rarities, canEdit }) {
  const [data, setData] = useState(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getPullRates(setId)
      .then(setData)
      .catch(() => setData({ chaseHitRatePct: null, rarities: [] }));
  }, [setId]);

  if (!data) return null;
  const byRarity = Object.fromEntries(data.rarities.map((r) => [r.rarity, r]));
  const hasAny = data.rarities.length > 0 || data.chaseHitRatePct != null;
  if (!canEdit && !hasAny) return null;

  function startEdit() {
    setForm({
      chaseHitRatePct: data.chaseHitRatePct != null ? String(data.chaseHitRatePct) : "",
      byRarity: Object.fromEntries(
        rarities.map((r) => [
          r,
          {
            any: byRarity[r]?.anyDenominator != null ? String(byRarity[r].anyDenominator) : "",
            specific: byRarity[r]?.specificDenominator != null ? String(byRarity[r].specificDenominator) : "",
          },
        ])
      ),
    });
    setEditing(true);
  }

  async function save() {
    setSaving(true);
    try {
      const payload = {
        chaseHitRatePct: form.chaseHitRatePct.trim() || null,
        rarities: Object.entries(form.byRarity).map(([rarity, v]) => ({
          rarity,
          anyDenominator: v.any.trim() || null,
          specificDenominator: v.specific.trim() || null,
        })),
      };
      const result = await updatePullRates(setId, payload);
      setData(result);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-surface border border-line rounded-2xl px-5 py-4 shadow-sm mb-6">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-medium">🎯 Pull Rates</p>
        {canEdit && !editing && (
          <button onClick={startEdit} className="text-xs text-subtle hover:text-ink underline">
            {hasAny ? "bearbeiten" : "eintragen"}
          </button>
        )}
      </div>

      {editing ? (
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2">
            <label className="text-xs text-subtle w-56 shrink-0">Chance auf mind. 1 Treffer (%)</label>
            <input
              type="number"
              step="0.1"
              min="0"
              max="100"
              value={form.chaseHitRatePct}
              onChange={(e) => setForm((f) => ({ ...f, chaseHitRatePct: e.target.value }))}
              className="border border-line rounded-full px-3 py-1 text-xs bg-canvas w-24 focus:outline-none focus:border-ink"
            />
          </div>
          {rarities.map((r) => (
            <div key={r} className="flex items-center gap-2">
              <label className="text-xs text-subtle w-56 shrink-0 truncate" title={r}>
                {r}
              </label>
              <span className="text-xs text-subtle">jede 1/</span>
              <input
                type="number"
                min="1"
                value={form.byRarity[r]?.any ?? ""}
                onChange={(e) =>
                  setForm((f) => ({ ...f, byRarity: { ...f.byRarity, [r]: { ...f.byRarity[r], any: e.target.value } } }))
                }
                className="border border-line rounded-full px-2 py-1 text-xs bg-canvas w-20 focus:outline-none focus:border-ink"
              />
              <span className="text-xs text-subtle">diese 1/</span>
              <input
                type="number"
                min="1"
                value={form.byRarity[r]?.specific ?? ""}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    byRarity: { ...f.byRarity, [r]: { ...f.byRarity[r], specific: e.target.value } },
                  }))
                }
                className="border border-line rounded-full px-2 py-1 text-xs bg-canvas w-20 focus:outline-none focus:border-ink"
              />
            </div>
          ))}
          <div className="flex gap-2 pt-1">
            <button
              onClick={save}
              disabled={saving}
              className="text-sm bg-yellow text-yellowInk px-3 py-1 rounded-full disabled:opacity-60"
            >
              {saving ? "…" : "Speichern"}
            </button>
            <button onClick={() => setEditing(false)} className="text-sm text-subtle">
              Abbrechen
            </button>
          </div>
        </div>
      ) : hasAny ? (
        <div className="space-y-1">
          {data.chaseHitRatePct != null && (
            <p className="text-sm">
              <span className="text-subtle">Chance auf mind. 1 Treffer: </span>
              <span className="font-mono">{data.chaseHitRatePct} %</span>
            </p>
          )}
          {data.rarities.map((r) => (
            <p key={r.rarity} className="text-xs">
              <span className="text-subtle">{r.rarity}: </span>
              {r.anyDenominator != null && <span className="font-mono">jede 1/{r.anyDenominator}</span>}
              {r.anyDenominator != null && r.specificDenominator != null && " · "}
              {r.specificDenominator != null && <span className="font-mono">diese 1/{r.specificDenominator}</span>}
            </p>
          ))}
        </div>
      ) : null}
    </div>
  );
}
