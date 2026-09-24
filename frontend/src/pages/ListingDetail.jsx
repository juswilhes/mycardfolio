import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { getListing, buyListing, postListingComment, getMarketplaceConfig } from "../api.js";
import { StarRating } from "../components/StarRating.jsx";
import ContactSellerDialog from "../components/ContactSellerDialog.jsx";

const eur = (cents) => `${(cents / 100).toFixed(2)} €`;

// Route: /marktplatz/angebot/:id – Detailansicht eines Angebots: großes
// Foto, Verkäufer-Vertrauen (Bewertung) und Fragen/Kommentare, statt eines
// reinen "Kaufen"-Buttons wie bei Cardmarket.
export default function ListingDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [listing, setListing] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [comment, setComment] = useState("");
  const [posting, setPosting] = useState(false);
  const [paymentsEnabled, setPaymentsEnabled] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const [contactSent, setContactSent] = useState(false);

  useEffect(() => {
    getMarketplaceConfig()
      .then((c) => setPaymentsEnabled(!!c.paymentsEnabled))
      .catch(() => {});
  }, []);

  const load = () =>
    getListing(id)
      .then(setListing)
      .catch(() => setNotFound(true));
  // Nicht useEffect(load, ...): load() gibt ein Promise zurück, React hielte es für die Cleanup-Funktion.
  useEffect(() => {
    load();
  }, [id]);

  async function buy() {
    setBusy(true);
    setError(null);
    try {
      const { url } = await buyListing(listing.id);
      window.location.href = url;
    } catch (err) {
      setError(err.message || "Kauf konnte nicht gestartet werden.");
      setBusy(false);
    }
  }

  async function submitComment(e) {
    e.preventDefault();
    if (!comment.trim() || posting) return;
    setPosting(true);
    try {
      await postListingComment(listing.id, comment.trim());
      setComment("");
      load();
    } finally {
      setPosting(false);
    }
  }

  if (notFound) {
    return (
      <div className="text-center py-16">
        <p className="text-subtle text-sm mb-4">Dieses Angebot gibt es nicht (mehr).</p>
        <Link to="/marktplatz" className="text-sm underline">Zurück zum Marktplatz</Link>
      </div>
    );
  }
  if (!listing) return <p className="text-subtle text-sm">Lade …</p>;

  const photo = listing.photo_url || listing.image_url;
  const isOwn = user && user.id === listing.seller_id;

  return (
    <div className="max-w-2xl">
      <Link to="/marktplatz" className="text-sm text-subtle hover:text-ink">← Marktplatz</Link>

      <div className="flex gap-5 mt-4 mb-2">
        {photo ? (
          <img src={photo} alt="" className="w-40 h-40 object-contain rounded-2xl border border-line bg-canvas shrink-0" />
        ) : (
          <div className="w-40 h-40 rounded-2xl border border-line bg-canvas flex items-center justify-center text-4xl shrink-0">
            📦
          </div>
        )}
        <div className="min-w-0">
          <h1 className="text-xl font-semibold">{listing.title}</h1>
          {listing.condition && <p className="text-subtle text-sm mt-1">Zustand: {listing.condition}</p>}
          <p className="text-2xl font-mono font-semibold mt-2">{eur(listing.price_cents)}</p>
          {listing.status !== "active" && (
            <p className="text-rose text-sm mt-1">
              {listing.status === "sold" ? "Bereits verkauft" : "Zurückgezogen"}
            </p>
          )}
        </div>
      </div>

      {listing.photo_url && (
        <p className="text-xs text-subtle mb-4">📷 Foto vom Verkäufer selbst hochgeladen – kein Stockbild.</p>
      )}

      {listing.description && (
        <p className="text-sm border border-line rounded-2xl p-4 mb-4 whitespace-pre-wrap">{listing.description}</p>
      )}

      <div className="flex items-center justify-between border-y border-line py-3 mb-4">
        <Link to={`/verkaeufer/${listing.seller_id}`} className="text-sm hover:underline">
          Verkäufer: <strong>{listing.seller_name || "mycardfolio-Nutzer"}</strong>
        </Link>
        <StarRating rating={listing.seller_rating} count={listing.seller_review_count} />
      </div>

      {error && <p className="text-rose text-sm mb-3">{error}</p>}
      {listing.status === "active" && !isOwn && (
        <button
          onClick={() => {
            if (!user) return navigate("/login");
            if (paymentsEnabled) return buy();
            setContactOpen(true);
          }}
          disabled={busy}
          className="bg-yellow text-yellowInk font-medium px-5 py-2.5 rounded-full text-sm disabled:opacity-60"
        >
          {busy ? "…" : !user ? "Anmelden" : paymentsEnabled ? "Kaufen" : "Kontakt aufnehmen"}
        </button>
      )}
      {!paymentsEnabled && listing.status === "active" && !isOwn && (
        <p className="text-xs text-subtle mt-3">
          ⚠️ Kein Käuferschutz: Zahlung und Versand regelt ihr direkt, mycardfolio ist nicht beteiligt.
        </p>
      )}
      {contactSent && (
        <p className="text-mint text-sm mt-3">✓ Nachricht gesendet – der Verkäufer antwortet dir per E-Mail.</p>
      )}
      {contactOpen && (
        <ContactSellerDialog
          listing={listing}
          onClose={() => setContactOpen(false)}
          onSent={() => {
            setContactOpen(false);
            setContactSent(true);
          }}
        />
      )}

      <div className="mt-10">
        <h2 className="text-sm font-semibold mb-3">
          💬 Fragen &amp; Kommentare {listing.comments.length > 0 && `(${listing.comments.length})`}
        </h2>
        {listing.comments.length === 0 ? (
          <p className="text-subtle text-sm mb-4">Noch keine Fragen. Sei die erste!</p>
        ) : (
          <div className="space-y-3 mb-4">
            {listing.comments.map((c) => (
              <div key={c.id} className="border border-line rounded-2xl px-4 py-3">
                <p className="text-xs text-subtle mb-1">
                  {c.author_name || "mycardfolio-Nutzer"} ·{" "}
                  {new Date(c.created_at).toLocaleDateString("de-DE")}
                </p>
                <p className="text-sm whitespace-pre-wrap">{c.body}</p>
              </div>
            ))}
          </div>
        )}

        {user ? (
          <form onSubmit={submitComment} className="flex gap-2">
            <input
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Frage an den Verkäufer stellen …"
              className="flex-1 border border-line rounded-full px-4 py-2 text-sm bg-surface focus:outline-none focus:border-ink"
            />
            <button
              disabled={posting}
              className="text-sm bg-yellow text-yellowInk font-medium px-4 py-2 rounded-full disabled:opacity-60"
            >
              {posting ? "…" : "Senden"}
            </button>
          </form>
        ) : (
          <p className="text-subtle text-sm">
            <Link to="/login" className="underline">Anmelden</Link>, um eine Frage zu stellen.
          </p>
        )}
      </div>
    </div>
  );
}
