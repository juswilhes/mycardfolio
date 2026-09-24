import { useEffect, useState } from "react";
import { contactSeller } from "../api.js";

// Kaufinteresse an den Verkäufer schicken (Stufe 1: ohne Bezahlfunktion).
// Der Verkäufer bekommt eine Mail und kann direkt an den Käufer antworten -
// deshalb der Hinweis, dass die E-Mail-Adresse weitergegeben wird.
export default function ContactSellerDialog({ listing, onClose, onSent }) {
  const [message, setMessage] = useState(
    `Hallo, ich interessiere mich für "${listing.title}". Ist die Karte noch verfügbar?`
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function submit(e) {
    e.preventDefault();
    if (busy || !message.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await contactSeller(listing.id, message.trim());
      onSent();
    } catch (err) {
      setError(err.message || "Nachricht konnte nicht gesendet werden.");
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-ink/40 backdrop-blur-sm"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <form onSubmit={submit} className="w-full max-w-sm bg-surface border border-line rounded-3xl p-6 shadow-xl">
        <p className="text-xs text-subtle mb-1">Verkäufer kontaktieren</p>
        <p className="font-semibold truncate mb-3">{listing.title}</p>
        <textarea
          autoFocus
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={4}
          className="w-full border border-line rounded-xl px-3 py-2 text-sm text-ink bg-canvas focus:outline-none focus:border-ink"
        />
        <p className="text-xs text-subtle mt-2">
          Der Verkäufer erhält deine Nachricht per E-Mail inklusive deiner E-Mail-Adresse und antwortet dir
          direkt. Zahlung und Versand regelt ihr untereinander – mycardfolio ist daran nicht beteiligt.
        </p>
        <p className="text-xs mt-2 text-ink">
          <strong>⚠️ Kein Käuferschutz:</strong> Zahle nur auf eine Weise, bei der du bei Problemen
          Geld zurückbekommen kannst, und vereinbare versicherten Versand.
        </p>
        {error && <p className="text-rose text-sm mt-2">{error}</p>}
        <div className="flex gap-2 mt-4">
          <button
            type="submit"
            disabled={busy}
            className="flex-1 bg-yellow text-yellowInk font-medium py-2 rounded-full text-sm disabled:opacity-60"
          >
            {busy ? "…" : "Nachricht senden"}
          </button>
          <button type="button" onClick={onClose} disabled={busy} className="px-4 py-2 rounded-full text-sm text-subtle">
            Abbrechen
          </button>
        </div>
      </form>
    </div>
  );
}
