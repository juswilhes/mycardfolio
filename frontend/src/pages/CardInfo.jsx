import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { getCardInfo, getCardPriceHistory, updateCardArtist, addToCollection, getWatchlistIds, refreshCardPrice } from "../api.js";
import { useAuth } from "../context/AuthContext.jsx";
import PriceSection from "../components/PriceSection.jsx";
import CollectionItemDialog from "../components/CollectionItemDialog.jsx";
import PortfolioAddedAnimation from "../components/PortfolioAddedAnimation.jsx";
import WatchlistHeart from "../components/WatchlistHeart.jsx";

// Route: /database/:externalId – frei zugänglich, auch ohne Konto.
// Bewusst reduziert: nur die Kern-Stammdaten + Preisverlauf. Die
// Illustrator-Angabe lässt sich hier von Hand ergänzen/korrigieren
// (angemeldet – schützt vor anonymem Vandalismus).
export default function CardInfo() {
  const { user, registrationOpen } = useAuth();
  const { externalId } = useParams();
  const [card, setCard] = useState(null);
  const [history, setHistory] = useState(null);
  const [error, setError] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [celebrate, setCelebrate] = useState(false);
  const [busy, setBusy] = useState(false);
  const [addError, setAddError] = useState(null);
  const [watched, setWatched] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const navigate = useNavigate();

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

  return (
    <div>
      <Link to="/sets" className="text-sm text-subtle hover:text-ink">
        ← Zur Kartendatenbank
      </Link>

      <div className="flex flex-col sm:flex-row gap-6 mt-4 mb-8">
        <img
          src={card.image_large ?? card.image_small}
          alt={`${card.name} (Englisch)`}
          className="w-52 rounded-2xl shrink-0 self-start shadow-sm"
        />
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold">{card.name}</h1>
          <p className="text-subtle text-sm mt-1">
            {card.set_name}
            {card.number ? ` · #${card.number}` : ""}
          </p>

          {user && <ArtistLine card={card} externalId={externalId} onSaved={setCard} />}

          <div className="mt-4 flex items-center gap-2">
            <button
              onClick={() =>
                user ? setDialogOpen(true) : navigate(registrationOpen ? "/register" : "/login")
              }
              className="bg-yellow text-yellowInk font-medium px-4 py-2 rounded-full text-sm"
            >
              {user ? "+ Zum Portfolio hinzufügen" : "Anmelden zum Hinzufügen"}
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
        <PortfolioAddedAnimation card={card} onDone={() => navigate("/")} />
      )}
    </div>
  );
}

// Illustrator-Zeile mit Inline-Bearbeitung. Fehlt der Wert, steht dort ein
// klarer Hinweis + "eintragen"-Link.
function ArtistLine({ card, externalId, onSaved }) {
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
          {card.artist}
          <button
            onClick={() => setEditing(true)}
            className="ml-2 text-xs text-subtle hover:text-ink underline"
          >
            ändern
          </button>
        </>
      ) : (
        <>
          <span className="text-rose">nicht hinterlegt</span>
          <button
            onClick={() => setEditing(true)}
            className="ml-2 text-xs text-ink underline"
          >
            eintragen
          </button>
        </>
      )}
    </p>
  );
}
