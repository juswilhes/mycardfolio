import { useEffect, useState } from "react";
import { useParams, Link, useNavigate, useLocation } from "react-router-dom";
import { getSealedCatalogItem, addSealedProduct } from "../api.js";
import { useAuth } from "../context/AuthContext.jsx";
import PriceSection from "../components/PriceSection.jsx";
import SealedProductDialog from "../components/SealedProductDialog.jsx";
import SealedAddedAnimation from "../components/SealedAddedAnimation.jsx";
import { usePageTitle } from "../hooks/usePageTitle.js";

// Route /sealed/:id - Produktseite eines versiegelten Produkts, aufgebaut wie die Kartenseite
// (Justus 09.11.2026): Bild, Steckbrief, aktueller Wert, Preisgraph, Link zu Cardmarket, "Zur Sammlung".
// Der Verlauf wird seit 09.11.2026 jede Nacht gespeichert (sealed_catalog_prices).
export default function SealedInfo() {
  const { id } = useParams();
  const { user, registrationOpen } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [item, setItem] = useState(null);
  const [error, setError] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [addError, setAddError] = useState(null);
  const [added, setAdded] = useState(false);
  const [celebrate, setCelebrate] = useState(null);
  usePageTitle(item ? `${item.name} – Wert & Preis | mycardfolio` : null);

  useEffect(() => {
    setItem(null);
    setError(false);
    getSealedCatalogItem(id)
      .then(setItem)
      .catch(() => setError(true));
  }, [id]);

  async function confirmAdd(values, meta) {
    setBusy(true);
    setAddError(null);
    try {
      await addSealedProduct({ ...values, setId: item.setId, setName: item.setName });
      setDialogOpen(false);
      setAdded(true);
      setCelebrate({ name: values.name, image: meta?.image ?? item.image ?? null });
    } catch (err) {
      setAddError(err.message || "Speichern fehlgeschlagen. Bitte nochmal versuchen.");
    } finally {
      setBusy(false);
    }
  }

  if (error) return <p className="text-rose text-sm">Produkt konnte nicht geladen werden.</p>;
  if (!item) return <p className="text-subtle text-sm">Lade Produkt …</p>;

  // dieselbe Form wie bei Karten: aktueller Preis aus der letzten gespeicherten Tagesreihe
  const card = {
    latest_price: item.priceCents != null ? { price: item.priceCents / 100, source: "cardmarket" } : null,
    price_breakdown: [],
    cardmarket_updated: item.updated,
    cardmarket_url: item.link,
  };
  const facts = [
    ["Set", item.setName],
    ["Erscheinungsjahr", item.releaseDate?.slice(0, 4)],
  ].filter(([, v]) => v);

  return (
    <div>
      {location.key !== "default" ? (
        <button onClick={() => navigate(-1)} className="text-sm text-subtle hover:text-ink">
          ← Zurück
        </button>
      ) : (
        <Link to={item.setSlug ? `/sets/${item.setSlug}` : "/sets"} className="text-sm text-subtle hover:text-ink">
          ← Zum Set
        </Link>
      )}

      <div className="flex flex-col sm:flex-row gap-6 mt-4 mb-8">
        {item.image ? (
          <img src={item.image} alt={item.name} className="w-52 h-52 object-contain shrink-0" />
        ) : (
          <span className="w-52 h-52 shrink-0 rounded-2xl border border-line" />
        )}
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold">{item.name}</h1>
          {item.setName && (
            <p className="text-subtle text-sm mt-1">
              <Link to={item.setSlug ? `/sets/${item.setSlug}` : "/sets"} className="hover:text-ink underline">
                {item.setName}
              </Link>
              {" · Sealed"}
            </p>
          )}
          <div className="mt-4">
            <button
              onClick={() => (user ? setDialogOpen(true) : navigate(registrationOpen ? "/register" : "/login"))}
              className="bg-yellow text-yellowInk font-medium px-4 py-2 rounded-full text-sm"
            >
              {user ? "+ Zur Sammlung hinzufügen" : "Anmelden zum Hinzufügen"}
            </button>
          </div>
          {added && (
            <p className="text-mint text-xs mt-2">
              Hinzugefügt – in deiner{" "}
              <Link to="/sammlung?ansicht=sealed" className="underline">
                Sammlung (Sealed)
              </Link>{" "}
              sichtbar.
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3 mb-8">
        {facts.map(([label, value]) => (
          <div key={label}>
            <p className="text-xs text-subtle">{label}</p>
            <p className="text-sm">{value}</p>
          </div>
        ))}
      </div>

      <PriceSection card={card} history={item.history} sealed />

      {dialogOpen && (
        <SealedProductDialog
          preset={item}
          setId={item.setId}
          setName={item.setName}
          busy={busy}
          error={addError}
          onConfirm={confirmAdd}
          onClose={() => !busy && (setDialogOpen(false), setAddError(null))}
        />
      )}
      {celebrate && <SealedAddedAnimation name={celebrate.name} image={celebrate.image} onDone={() => setCelebrate(null)} />}
    </div>
  );
}
