import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { getSellerProfile } from "../api.js";
import { StarRating } from "../components/StarRating.jsx";

const eur = (cents) => `${(cents / 100).toFixed(2)} €`;

// Route: /verkaeufer/:userId – öffentliches Profil: Bewertungsschnitt,
// abgeschlossene Verkäufe, Bewertungstexte und aktive Angebote. Cardmarket
// zeigt kaum mehr als eine Prozentzahl - hier soll man einer Person
// vertrauen können, nicht nur einer Kennziffer.
export default function SellerProfile() {
  const { userId } = useParams();
  const [profile, setProfile] = useState(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    getSellerProfile(userId)
      .then(setProfile)
      .catch(() => setNotFound(true));
  }, [userId]);

  if (notFound) {
    return <p className="text-subtle text-sm">Dieses Verkäuferprofil gibt es nicht.</p>;
  }
  if (!profile) return <p className="text-subtle text-sm">Lade …</p>;

  return (
    <div className="max-w-2xl">
      <Link to="/marktplatz" className="text-sm text-subtle hover:text-ink">← Marktplatz</Link>

      <h1 className="text-xl font-semibold mt-4 mb-1">{profile.display_name || "mycardfolio-Nutzer"}</h1>
      <div className="flex items-center gap-4 mb-6">
        <StarRating rating={profile.rating} count={profile.review_count} />
        <span className="text-subtle text-xs">{profile.sales_count} abgeschlossene Verkäufe</span>
      </div>

      <h2 className="text-sm font-semibold mb-3">Aktive Angebote</h2>
      {profile.listings.length === 0 ? (
        <p className="text-subtle text-sm mb-8">Gerade keine aktiven Angebote.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-8">
          {profile.listings.map((l) => (
            <Link
              key={l.id}
              to={`/marktplatz/angebot/${l.id}`}
              className="border border-line rounded-2xl p-3 flex flex-col hover:border-ink"
            >
              {(l.photo_url || l.image_url) ? (
                <img
                  src={l.photo_url || l.image_url}
                  alt=""
                  className="rounded-xl mb-2 object-contain h-28 bg-canvas"
                />
              ) : (
                <div className="rounded-xl mb-2 h-28 bg-canvas flex items-center justify-center text-2xl">📦</div>
              )}
              <p className="text-xs font-medium truncate">{l.title}</p>
              <p className="text-xs font-mono mt-auto pt-1">{eur(l.price_cents)}</p>
            </Link>
          ))}
        </div>
      )}

      <h2 className="text-sm font-semibold mb-3">
        Bewertungen {profile.reviews.length > 0 && `(${profile.reviews.length})`}
      </h2>
      {profile.reviews.length === 0 ? (
        <p className="text-subtle text-sm">Noch keine Bewertungen.</p>
      ) : (
        <div className="space-y-3">
          {profile.reviews.map((r) => (
            <div key={r.id} className="border border-line rounded-2xl px-4 py-3">
              <p className="text-xs text-subtle mb-1">
                <span className="text-yellow">{"★".repeat(r.rating)}</span>
                <span className="text-line">{"★".repeat(5 - r.rating)}</span>{" "}
                {r.reviewer_name || "mycardfolio-Nutzer"} ·{" "}
                {new Date(r.created_at).toLocaleDateString("de-DE")}
              </p>
              {r.comment && <p className="text-sm">{r.comment}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
