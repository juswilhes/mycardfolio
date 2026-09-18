import { useEffect, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import {
  getMarketplaceConfig,
  getMarketplaceListings,
  getMyListings,
  getMyOrders,
  cancelListing,
  buyListing,
  getSellerStatus,
  startSellerOnboarding,
  shipOrder,
} from "../api.js";

const eur = (cents) => `${(cents / 100).toFixed(2)} €`;

// Route: /marktplatz – Karten & Sealed-Produkte, die andere Nutzer
// verkaufen. Zahlung läuft über Stripe Connect (siehe Backend); solange
// dort keine Stripe-Keys hinterlegt sind, antwortet die API mit 503 und
// diese Seite zeigt stattdessen einen "startet in Kürze"-Hinweis.
export default function Marketplace() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [tab, setTab] = useState("kaufen");
  const [unavailable, setUnavailable] = useState(false);
  const [feePercent, setFeePercent] = useState(null);
  const [listings, setListings] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [buyError, setBuyError] = useState(null);

  useEffect(() => {
    getMarketplaceConfig()
      .then((c) => setFeePercent(c.feePercent))
      .catch((err) => setUnavailable(err.status === 503));
    getMarketplaceListings()
      .then(setListings)
      .catch(() => setListings([]));
  }, []);

  async function buy(listing) {
    setBusyId(listing.id);
    setBuyError(null);
    try {
      const { url } = await buyListing(listing.id);
      window.location.href = url;
    } catch (err) {
      setBuyError(err.message || "Kauf konnte nicht gestartet werden.");
      setBusyId(null);
    }
  }

  if (unavailable) {
    return (
      <div className="text-center py-24">
        <p className="text-lg font-medium mb-1">🚧 Marktplatz startet in Kürze</p>
        <p className="text-subtle max-w-md mx-auto">
          Hier kannst du bald Karten und Sealed-Produkte an andere mycardfolio-Nutzer verkaufen und
          kaufen. Die Zahlungsabwicklung wird gerade eingerichtet.
        </p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-xl font-semibold mb-1">🛒 Marktplatz</h1>
      <p className="text-subtle text-sm mb-6">
        Karten &amp; Sealed-Produkte von anderen mycardfolio-Nutzern kaufen oder deine eigenen
        verkaufen.
        {feePercent != null && ` mycardfolio behält ${feePercent}% Provision je Verkauf.`} Mit
        einem Kauf oder Angebot gelten die{" "}
        <Link to="/marktplatz-agb" className="underline hover:text-ink">
          Marktplatz-Nutzungsbedingungen
        </Link>
        .
      </p>

      {params.get("kauf") === "erfolgreich" && (
        <p className="bg-mint/15 text-mint border border-mint/30 rounded-2xl px-4 py-3 text-sm mb-6">
          ✓ Kauf erfolgreich! Der Verkäufer wurde benachrichtigt und meldet sich mit dem Versand.
        </p>
      )}

      <div className="flex gap-4 border-b border-line mb-6 text-sm">
        {[
          ["kaufen", "Kaufen"],
          ["angebote", "Meine Angebote"],
          ["bestellungen", "Meine Bestellungen"],
        ].map(([key, label]) => (
          <button
            key={key}
            onClick={() => (user ? setTab(key) : navigate("/login"))}
            className={`pb-2 -mb-px border-b-2 ${
              tab === key ? "border-ink font-medium" : "border-transparent text-subtle hover:text-ink"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "kaufen" && (
        <>
          {buyError && <p className="text-rose text-sm mb-4">{buyError}</p>}
          {listings === null ? (
            <p className="text-subtle text-sm">Lade Angebote …</p>
          ) : listings.length === 0 ? (
            <p className="text-subtle text-sm">Noch keine Angebote. Sei die erste Verkäuferin!</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {listings.map((l) => (
                <div key={l.id} className="border border-line rounded-2xl p-3 flex flex-col">
                  {l.image_url ? (
                    <img src={l.image_url} alt="" className="rounded-xl mb-2 object-contain h-40 bg-canvas" />
                  ) : (
                    <div className="rounded-xl mb-2 h-40 bg-canvas flex items-center justify-center text-3xl">
                      📦
                    </div>
                  )}
                  <p className="text-sm font-medium truncate">{l.title}</p>
                  <p className="text-subtle text-xs truncate">
                    {l.condition ? `${l.condition} · ` : ""}Verkäufer: {l.seller_name || "mycardfolio-Nutzer"}
                  </p>
                  <div className="mt-auto flex items-center justify-between pt-2">
                    <span className="font-mono font-medium">{eur(l.price_cents)}</span>
                    <button
                      onClick={() => (user ? buy(l) : navigate("/login"))}
                      disabled={busyId === l.id}
                      className="text-xs bg-yellow text-yellowInk font-medium px-3 py-1.5 rounded-full disabled:opacity-60"
                    >
                      {busyId === l.id ? "…" : user ? "Kaufen" : "Anmelden zum Kaufen"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {tab === "angebote" && user && <MyListings />}
      {tab === "bestellungen" && user && <MyOrders />}
    </div>
  );
}

function MyListings() {
  const [status, setStatus] = useState(null);
  const [onboarding, setOnboarding] = useState(false);
  const [listings, setListings] = useState(null);
  const [error, setError] = useState(null);

  const load = () => {
    getSellerStatus().then(setStatus).catch(() => setStatus(null));
    getMyListings().then(setListings).catch(() => setListings([]));
  };
  useEffect(load, []);

  async function onboard() {
    setOnboarding(true);
    setError(null);
    try {
      const { url } = await startSellerOnboarding();
      window.location.href = url;
    } catch (err) {
      setError(err.message || "Einrichtung fehlgeschlagen.");
      setOnboarding(false);
    }
  }

  async function cancel(id) {
    await cancelListing(id);
    load();
  }

  if (status && !status.onboardingComplete) {
    return (
      <div className="border border-line rounded-2xl p-6 text-center">
        <p className="font-medium mb-1">Verkäuferkonto einrichten</p>
        <p className="text-subtle text-sm mb-4 max-w-md mx-auto">
          Damit Käufer dich bezahlen können, richtet Stripe (unser Zahlungsdienstleister) einmalig ein
          Verkäuferkonto für dich ein – Identität &amp; Bankverbindung trägst du direkt bei Stripe ein,
          mycardfolio sieht das nie.
        </p>
        {error && <p className="text-rose text-sm mb-3">{error}</p>}
        <button
          onClick={onboard}
          disabled={onboarding}
          className="bg-yellow text-yellowInk font-medium px-5 py-2.5 rounded-full text-sm disabled:opacity-60"
        >
          {onboarding ? "…" : status.hasAccount ? "Einrichtung fortsetzen" : "Verkäuferkonto einrichten"}
        </button>
      </div>
    );
  }

  return (
    <div>
      <p className="text-subtle text-sm mb-4">
        Karten oder Sealed-Produkte zum Verkauf anbieten geht direkt in deiner{" "}
        <a href="/" className="underline">
          Sammlung
        </a>{" "}
        bei jedem Eintrag.
      </p>
      {listings === null ? (
        <p className="text-subtle text-sm">Lade …</p>
      ) : listings.length === 0 ? (
        <p className="text-subtle text-sm">Noch keine Angebote erstellt.</p>
      ) : (
        <div className="space-y-2">
          {listings.map((l) => (
            <div key={l.id} className="border border-line rounded-2xl p-3 flex items-center gap-3">
              {l.image_url && <img src={l.image_url} alt="" className="w-12 h-12 object-contain rounded-lg bg-canvas" />}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{l.title}</p>
                <p className="text-xs text-subtle">
                  {eur(l.price_cents)} ·{" "}
                  {l.status === "active" ? "aktiv" : l.status === "sold" ? "verkauft" : "zurückgezogen"}
                </p>
              </div>
              {l.status === "active" && (
                <button
                  onClick={() => cancel(l.id)}
                  className="text-xs border border-line px-3 py-1.5 rounded-full hover:border-rose hover:text-rose"
                >
                  Zurückziehen
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MyOrders() {
  const [orders, setOrders] = useState(null);
  const [shippingId, setShippingId] = useState(null);
  const [tracking, setTracking] = useState("");

  const load = () => getMyOrders().then(setOrders).catch(() => setOrders({ purchases: [], sales: [] }));
  useEffect(load, []);

  async function submitShip(id) {
    await shipOrder(id, tracking.trim() || null);
    setShippingId(null);
    setTracking("");
    load();
  }

  if (orders === null) return <p className="text-subtle text-sm">Lade …</p>;

  const STATUS_LABEL = {
    pending: "wartet auf Zahlung",
    paid: "bezahlt",
    shipped: "versandt",
    completed: "abgeschlossen",
    cancelled: "storniert",
    refunded: "erstattet",
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-sm font-semibold mb-3">Käufe</h2>
        {orders.purchases.length === 0 ? (
          <p className="text-subtle text-sm">Noch nichts gekauft.</p>
        ) : (
          <div className="space-y-2">
            {orders.purchases.map((o) => (
              <div key={o.id} className="border border-line rounded-2xl p-3 flex items-center gap-3">
                {o.image_url && <img src={o.image_url} alt="" className="w-12 h-12 object-contain rounded-lg bg-canvas" />}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{o.title}</p>
                  <p className="text-xs text-subtle">
                    {eur(o.amount_cents)} · {STATUS_LABEL[o.status] ?? o.status}
                    {o.tracking_code ? ` · Tracking: ${o.tracking_code}` : ""}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <h2 className="text-sm font-semibold mb-3">Verkäufe</h2>
        {orders.sales.length === 0 ? (
          <p className="text-subtle text-sm">Noch nichts verkauft.</p>
        ) : (
          <div className="space-y-2">
            {orders.sales.map((o) => (
              <div key={o.id} className="border border-line rounded-2xl p-3">
                <div className="flex items-center gap-3">
                  {o.image_url && <img src={o.image_url} alt="" className="w-12 h-12 object-contain rounded-lg bg-canvas" />}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{o.title}</p>
                    <p className="text-xs text-subtle">
                      {eur(o.amount_cents)} · {STATUS_LABEL[o.status] ?? o.status}
                      {o.shipping_name ? ` · an ${o.shipping_name}` : ""}
                    </p>
                  </div>
                  {o.status === "paid" && shippingId !== o.id && (
                    <button
                      onClick={() => setShippingId(o.id)}
                      className="text-xs border border-line px-3 py-1.5 rounded-full hover:border-ink"
                    >
                      Als versandt markieren
                    </button>
                  )}
                </div>
                {shippingId === o.id && (
                  <div className="flex items-center gap-2 mt-3">
                    <input
                      autoFocus
                      value={tracking}
                      onChange={(e) => setTracking(e.target.value)}
                      placeholder="Tracking-Nr. (optional)"
                      className="flex-1 border border-line rounded-full px-3 py-1.5 text-sm bg-surface focus:outline-none focus:border-ink"
                    />
                    <button
                      onClick={() => submitShip(o.id)}
                      className="text-sm bg-yellow text-yellowInk px-3 py-1.5 rounded-full"
                    >
                      Bestätigen
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
