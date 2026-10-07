import { useCallback, useEffect, useState } from "react";
import { useParams, Link, useNavigate, useLocation } from "react-router-dom";
import {
  getCardInfo,
  getCardPriceHistory,
  updateCardArtist,
  addToCollection,
  getWatchlistIds,
  refreshCardPrice,
  getListingsForCard,
  getCollection,
  updateCollectionItem,
  deleteCollectionItem,
  sellCollectionItem,
  createListing,
} from "../api.js";
import { useAuth } from "../context/AuthContext.jsx";
import PriceSection from "../components/PriceSection.jsx";
import CollectionItemDialog, { conditionLabel, variantLabel, gradeLabel } from "../components/CollectionItemDialog.jsx";
import PortfolioAddedAnimation from "../components/PortfolioAddedAnimation.jsx";
import WatchlistHeart from "../components/WatchlistHeart.jsx";
import CardMarketListings from "../components/CardMarketListings.jsx";
import ZoomableCardImage from "../components/ZoomableCardImage.jsx";
import SellDialog from "../components/SellDialog.jsx";
import SaleCelebrationAnimation from "../components/SaleCelebrationAnimation.jsx";
import SellListingDialog from "../components/SellListingDialog.jsx";

const fmt = (n) => `${Number(n).toFixed(2)} €`;

const entryCost = (e) =>
  e.purchase_price != null || e.shipping_cost != null
    ? ((e.purchase_price ?? 0) + (e.shipping_cost ?? 0)) * (e.quantity ?? 1)
    : null;

// Route: /database/:externalId – frei zugänglich, auch ohne Konto. Dieselbe
// Seite für die Kartensuche UND die Sammlung: ist man angemeldet und besitzt
// die Karte, erscheint darunter zusätzlich "Deine Sammlung" mit den eigenen
// Käufen. Vorher gab es dafür zwei fast identische Seiten (/card/:cardId
// für die Sammlung, /database/:externalId für die Suche) - das war
// verwirrend (zwei verschiedene Ansichten derselben Karte) und doppelter
// Code. Die Illustrator-Angabe lässt sich hier von Hand ergänzen/korrigieren
// (nur der Betreiber – schützt vor Vandalismus durch angemeldete Nutzer).
export default function CardInfo() {
  const { user, registrationOpen } = useAuth();
  const { externalId } = useParams();
  const location = useLocation();
  const [card, setCard] = useState(null);
  const [history, setHistory] = useState(null);
  const [error, setError] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [celebrate, setCelebrate] = useState(false);
  const [busy, setBusy] = useState(false);
  const [addError, setAddError] = useState(null);
  const [watched, setWatched] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [listings, setListings] = useState(null);
  const navigate = useNavigate();

  // Eigene Käufe dieser Karte (nur mit Login) - "Deine Sammlung" unten.
  const [entries, setEntries] = useState(null);
  const [editEntry, setEditEntry] = useState(null);
  const [sellEntry, setSellEntry] = useState(null);
  const [celebration, setCelebration] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [entriesBusy, setEntriesBusy] = useState(false);
  const [listEntry, setListEntry] = useState(null);
  const [listError, setListError] = useState(null);
  const [listed, setListed] = useState(null);

  const loadEntries = useCallback(() => {
    if (!user) return setEntries([]);
    return getCollection()
      .then((items) => setEntries(items.filter((i) => i.external_id === externalId)))
      .catch(() => setEntries([]));
  }, [externalId, user]);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await refreshCardPrice(externalId);
      const [c, h] = await Promise.all([getCardInfo(externalId), getCardPriceHistory(externalId)]);
      setCard(c);
      setHistory(h ?? []);
    } catch {
      /* z.B. Cooldown - still ignorieren, Preis bleibt wie gehabt */
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    if (!user) return setWatched(false);
    getWatchlistIds().then((ids) => setWatched(ids.includes(externalId))).catch(() => {});
  }, [externalId, user]);

  useEffect(() => {
    setListings(null);
    getListingsForCard(externalId)
      .then(setListings)
      .catch(() => setListings([]));
  }, [externalId]);

  useEffect(() => {
    setCard(null);
    setHistory(null);
    setError(false);
    // erst die Karteninfo (stößt serverseitig den Preis-Abruf an), dann die
    // Historie – sonst wäre der frische Datenpunkt noch nicht geschrieben.
    getCardInfo(externalId)
      .then((c) => {
        setCard(c);
        getCardPriceHistory(externalId)
          .then((h) => setHistory(h ?? []))
          .catch(() => setHistory([]));
      })
      .catch(() => {
        setError(true);
        setHistory([]);
      });
  }, [externalId]);

  async function confirmAdd({ lots, ...shared }) {
    setBusy(true);
    setAddError(null);
    let done = 0;
    try {
      for (const lot of lots) {
        await addToCollection({ ...shared, ...lot, externalId });
        done++;
      }
      setDialogOpen(false);
      setCelebrate(true);
    } catch (err) {
      setAddError(
        `${err.message || "Speichern fehlgeschlagen"}${
          lots.length > 1 ? ` (${done}/${lots.length} Käufe bereits gespeichert)` : ""
        }`
      );
    } finally {
      setBusy(false);
    }
  }

  async function withEntriesReload(fn) {
    setEntriesBusy(true);
    try {
      await fn();
      await loadEntries();
    } finally {
      setEntriesBusy(false);
    }
  }

  const saveEdit = (values) =>
    withEntriesReload(() => updateCollectionItem(editEntry.collection_item_id, values)).then(() =>
      setEditEntry(null)
    );

  async function sell(values) {
    setEntriesBusy(true);
    try {
      const e = sellEntry;
      await sellCollectionItem(e.collection_item_id, values);
      const q = e.quantity ?? 1;
      const c = ((e.purchase_price ?? 0) + (e.shipping_cost ?? 0)) * q;
      const proceeds =
        ((values.salePrice ?? 0) + (values.saleShipping ?? 0) - (values.saleFees ?? 0)) * q;
      const realized = proceeds - c;
      setSellEntry(null);
      setCelebration({ card, realized, cost: c, proceeds, big: c > 0 && realized / c > 0.5 });
      await loadEntries();
    } finally {
      setEntriesBusy(false);
    }
  }

  const removeEntry = (id) => withEntriesReload(() => deleteCollectionItem(id)).then(() => setConfirmDeleteId(null));

  async function listOnMarketplace(values) {
    setEntriesBusy(true);
    setListError(null);
    try {
      await createListing({
        kind: "card",
        collectionItemId: listEntry.collection_item_id,
        ...values,
      });
      setListEntry(null);
      setListed(listEntry.collection_item_id);
      loadEntries();
    } catch (err) {
      setListError(
        err.status === 503
          ? "Der Marktplatz ist noch nicht eingerichtet."
          : err.message || "Angebot konnte nicht erstellt werden."
      );
    } finally {
      setEntriesBusy(false);
    }
  }

  if (error) return <p className="text-rose text-sm">Karteninfo konnte nicht geladen werden.</p>;
  if (!card) return <p className="text-subtle text-sm">Lade Kartendetails …</p>;

  const kartentyp = [card.supertype, (card.types ?? []).join("/")].filter(Boolean).join(" · ");

  const facts = [
    ["Seltenheit", card.rarity],
    ["Kartennummer", card.number ? `#${card.number}` : null],
    ["Kartentyp", kartentyp],
    ["Erscheinungsjahr", card.year],
    ["Set", card.set_name],
    ["Pokédex-Nr.", (card.national_pokedex ?? []).join(", ")],
  ].filter(([, v]) => v);

  const price = card.latest_price?.price ?? null;
  const totalQty = (entries ?? []).reduce((s, e) => s + (e.quantity ?? 1), 0);
  const withCost = (entries ?? []).filter((e) => entryCost(e) != null);
  const totalCost = withCost.reduce((s, e) => s + entryCost(e), 0);
  const totalValue = price != null ? price * totalQty : null;
  const valueOfPriced =
    price != null ? price * withCost.reduce((s, e) => s + (e.quantity ?? 1), 0) : 0;
  const totalGain = withCost.length ? valueOfPriced - totalCost : null;

  return (
    <div>
      {location.key !== "default" ? (
        <button onClick={() => navigate(-1)} className="text-sm text-subtle hover:text-ink">
          ← Zurück
        </button>
      ) : (
        <Link to="/sets" className="text-sm text-subtle hover:text-ink">
          ← Zur Kartendatenbank
        </Link>
      )}

      <div className="flex flex-col sm:flex-row gap-6 mt-4 mb-8">
        <ZoomableCardImage
          src={card.image_large ?? card.image_small}
          alt={`${card.name} (Englisch)`}
          className="w-52 rounded-2xl shadow-sm"
        />
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold">{card.name}</h1>
          <p className="text-subtle text-sm mt-1">
            {card.set_name}
            {card.number ? ` · #${card.number}` : ""}
          </p>

          <ArtistLine card={card} externalId={externalId} onSaved={setCard} canEdit={!!user?.is_operator} />

          <div className="mt-4 flex items-center gap-2">
            <button
              onClick={() =>
                user ? setDialogOpen(true) : navigate(registrationOpen ? "/register" : "/login")
              }
              className="bg-yellow text-yellowInk font-medium px-4 py-2 rounded-full text-sm"
            >
              {user ? "+ Zum Portfolio hinzufügen" : "Anmelden zum Hinzufügen"}
            </button>
            <button
              onClick={() => document.getElementById("angebote")?.scrollIntoView({ behavior: "smooth" })}
              disabled={!listings || listings.length === 0}
              className="border border-line px-4 py-2 rounded-full text-sm hover:border-ink disabled:opacity-50 disabled:hover:border-line"
            >
              {listings && listings.length > 0
                ? `🛒 ${listings.length} ${listings.length === 1 ? "Angebot" : "Angebote"} ansehen`
                : "🛒 Keine Angebote"}
            </button>
            {user && (
              <WatchlistHeart
                externalId={externalId}
                watched={watched}
                onChange={setWatched}
                className="w-10 h-10 flex items-center justify-center rounded-full border border-line text-xl hover:border-ink"
              />
            )}
          </div>
        </div>
      </div>

      {/* Steckbrief */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3 mb-8">
        {facts.map(([label, value]) => (
          <div key={label}>
            <p className="text-xs text-subtle">{label}</p>
            <p className="text-sm">{value}</p>
          </div>
        ))}
      </div>

      <PriceSection
        card={card}
        history={history}
        onRefresh={user ? handleRefresh : undefined}
        refreshing={refreshing}
      />

      <CardMarketListings listings={listings} />

      {entries && entries.length > 0 && (
        <div className="mt-10">
          <h2 className="text-sm font-medium mb-3">📦 Deine Sammlung</h2>

          <div className="border-t border-line">
            <Row label="Exemplare in deiner Sammlung" value={`${totalQty}×`} />
            {totalCost > 0 && <Row label="Einstandswert gesamt" value={fmt(totalCost)} mono />}
            {totalValue != null && <Row label="Aktueller Wert gesamt" value={fmt(totalValue)} mono />}
            {totalGain != null && (
              <Row
                label="Wertentwicklung gesamt"
                value={
                  <span className={totalGain >= 0 ? "text-mint" : "text-rose"}>
                    {totalGain >= 0 ? "+" : "−"}
                    {fmt(Math.abs(totalGain))}
                    {totalCost > 0 && (
                      <span className="text-subtle">
                        {"  "}({totalGain >= 0 ? "+" : "−"}
                        {Math.abs((totalGain / totalCost) * 100).toFixed(1)} %)
                      </span>
                    )}
                  </span>
                }
                mono
              />
            )}
          </div>

          <h3 className="text-xs text-subtle mt-6 mb-3">
            {entries.length > 1 ? `Deine ${entries.length} Käufe` : "Dein Exemplar"}
          </h3>
          <div className="space-y-3">
            {entries.map((e) => {
              const c = entryCost(e);
              const v = price != null ? price * (e.quantity ?? 1) : null;
              const g = c != null && v != null ? v - c : null;
              return (
                <div key={e.collection_item_id} className="border border-line rounded-2xl p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <span className="text-subtle">
                      {e.purchase_date
                        ? `Gekauft am ${new Date(e.purchase_date).toLocaleDateString("de-DE")}`
                        : "Kaufdatum unbekannt"}
                      {" · "}
                      {conditionLabel(e.condition)}
                      {gradeLabel(e.grading_company, e.grade) ? ` · ${gradeLabel(e.grading_company, e.grade)}` : ""}
                      {e.variant && e.variant !== "normal" ? ` · ${variantLabel(e.variant)}` : ""}
                      {" · "}
                      {e.language === "de" ? "Deutsch" : "Englisch"}
                      {(e.quantity ?? 1) > 1 ? ` · ${e.quantity}×` : ""}
                    </span>
                    {g != null && (
                      <span className={`font-mono ${g >= 0 ? "text-mint" : "text-rose"}`}>
                        {g >= 0 ? "+" : "−"}
                        {fmt(Math.abs(g))}
                        {c > 0 && ` (${g >= 0 ? "+" : "−"}${Math.abs((g / c) * 100).toFixed(1)} %)`}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-x-6 gap-y-1 mt-2 text-xs text-subtle">
                    {e.purchase_price != null && <span>Kaufpreis {fmt(e.purchase_price)}</span>}
                    {e.shipping_cost != null && <span>Versand {fmt(e.shipping_cost)}</span>}
                    {c != null && <span>Einstand {fmt(c)}</span>}
                    {v != null && <span>Wert {fmt(v)}</span>}
                    {e.notes && <span>„{e.notes}"</span>}
                  </div>

                  <div className="flex flex-wrap gap-2 mt-3">
                    <button
                      onClick={() => setEditEntry(e)}
                      className="border border-line text-xs px-3 py-1.5 rounded-full hover:border-ink"
                    >
                      Bearbeiten
                    </button>
                    <button
                      onClick={() => setSellEntry(e)}
                      className="border border-line text-xs px-3 py-1.5 rounded-full hover:border-ink"
                    >
                      Verkauft
                    </button>
                    {e.listing_id || listed === e.collection_item_id ? (
                      <Link
                        to={e.listing_id ? `/marktplatz/angebot/${e.listing_id}` : "/marktplatz"}
                        className="border border-mint text-mint text-xs px-3 py-1.5 rounded-full"
                      >
                        🛒 Im Marktplatz angeboten
                      </Link>
                    ) : (
                      <button
                        onClick={() => { setListError(null); setListEntry(e); }}
                        className="border border-line text-xs px-3 py-1.5 rounded-full hover:border-ink"
                      >
                        🛒 Im Marktplatz anbieten
                      </button>
                    )}
                    {confirmDeleteId === e.collection_item_id ? (
                      <>
                        <button
                          onClick={() => removeEntry(e.collection_item_id)}
                          disabled={entriesBusy}
                          className="bg-rose text-white text-xs px-3 py-1.5 rounded-full disabled:opacity-60"
                        >
                          {entriesBusy ? "…" : "Wirklich entfernen"}
                        </button>
                        <button
                          onClick={() => setConfirmDeleteId(null)}
                          className="text-xs px-3 py-1.5 rounded-full text-subtle"
                        >
                          Abbrechen
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => setConfirmDeleteId(e.collection_item_id)}
                        className="border border-line text-xs px-3 py-1.5 rounded-full text-rose hover:border-rose"
                      >
                        Entfernen
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {dialogOpen && (
        <CollectionItemDialog
          card={card}
          busy={busy}
          error={addError}
          onConfirm={confirmAdd}
          onClose={() => !busy && (setDialogOpen(false), setAddError(null))}
        />
      )}
      {celebrate && (
        <PortfolioAddedAnimation card={card} onDone={() => { setCelebrate(false); loadEntries(); }} />
      )}

      {listEntry && (
        <SellListingDialog
          title={`${card.name} (${card.set_name} #${card.number})`}
          image={card.image_small}
          busy={entriesBusy}
          error={listError}
          onConfirm={listOnMarketplace}
          onClose={() => !entriesBusy && setListEntry(null)}
        />
      )}
      {editEntry && (
        <CollectionItemDialog
          card={card}
          initial={editEntry}
          title="Kauf bearbeiten"
          submitLabel="Speichern"
          busy={entriesBusy}
          onConfirm={saveEdit}
          onClose={() => !entriesBusy && setEditEntry(null)}
        />
      )}
      {sellEntry && (
        <SellDialog
          item={sellEntry}
          busy={entriesBusy}
          onConfirm={sell}
          onClose={() => !entriesBusy && setSellEntry(null)}
        />
      )}
      {celebration && (
        <SaleCelebrationAnimation {...celebration} onDone={() => { setCelebration(null); navigate("/verkauft"); }} />
      )}
    </div>
  );
}

function Row({ label, value, mono }) {
  return (
    <div className="flex justify-between py-3 border-b border-line text-sm">
      <span className="text-subtle">{label}</span>
      <span className={mono ? "font-mono" : ""}>{value}</span>
    </div>
  );
}

// Illustrator-Zeile mit Inline-Bearbeitung. Fehlt der Wert, steht dort ein
// klarer Hinweis + "eintragen"-Link.
function ArtistLine({ card, externalId, onSaved, canEdit }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(card.artist ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    const v = value.trim();
    if (!v) return;
    setSaving(true);
    try {
      await updateCardArtist(externalId, v);
      onSaved({ ...card, artist: v, artist_source: "manual", artist_manual: true });
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <div className="mt-2 flex items-center gap-2">
        <input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && save()}
          placeholder="Name des Illustrators"
          className="border border-line rounded-full px-3 py-1 text-sm bg-surface focus:outline-none focus:border-ink"
        />
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
    );
  }

  return (
    <p className="text-sm mt-2">
      <span className="text-subtle">Illustrator: </span>
      {card.artist ? (
        <>
          <Link to={`/illustrator/${encodeURIComponent(card.artist)}`} className="underline hover:text-ink">
            {card.artist}
          </Link>
          {canEdit && (
            <button
              onClick={() => setEditing(true)}
              className="ml-2 text-xs text-subtle hover:text-ink underline"
            >
              ändern
            </button>
          )}
        </>
      ) : canEdit ? (
        <>
          <span className="text-rose">nicht hinterlegt</span>
          <button
            onClick={() => setEditing(true)}
            className="ml-2 text-xs text-ink underline"
          >
            eintragen
          </button>
        </>
      ) : (
        <span className="text-subtle">nicht hinterlegt</span>
      )}
    </p>
  );
}
