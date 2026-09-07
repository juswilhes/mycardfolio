import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { getCardInfo, getCardPriceHistory, updateCardArtist, addToCollection } from "../api.js";
import PriceSection from "../components/PriceSection.jsx";
import CollectionItemDialog from "../components/CollectionItemDialog.jsx";
import PortfolioAddedAnimation from "../components/PortfolioAddedAnimation.jsx";

// Route: /database/:externalId
// Bewusst reduziert: nur die Kern-Stammdaten + Preisverlauf. Die
// Illustrator-Angabe lässt sich hier von Hand ergänzen/korrigieren.
export default function CardInfo() {
  const { externalId } = useParams();
  const [card, setCard] = useState(null);
  const [history, setHistory] = useState(null);
  const [error, setError] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [celebrate, setCelebrate] = useState(false);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

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

  async function confirmAdd(values) {
    setBusy(true);
    try {
      await addToCollection({ ...values, externalId });
      setDialogOpen(false);
      setCelebrate(true);
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

          <ArtistLine card={card} externalId={externalId} onSaved={setCard} />

          <button
            onClick={() => setDialogOpen(true)}
            className="mt-4 bg-yellow text-yellowInk font-medium px-4 py-2 rounded-full text-sm"
          >
            + Zum Portfolio hinzufügen
          </button>
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

      <PriceSection card={card} history={history} />

      {dialogOpen && (
        <CollectionItemDialog
          card={card}
          busy={busy}
          onConfirm={confirmAdd}
          onClose={() => !busy && setDialogOpen(false)}
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
