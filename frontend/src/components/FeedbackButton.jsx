import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { sendFeedback } from "../api.js";
import Icon from "./Icon.jsx";

// Feedback-Knopf unten rechts auf jeder Seite (für die ersten Testnutzer): kurzes Formular,
// die Nachricht geht per E-Mail an den Betreiber (backend/src/routes/feedback.js).
export default function FeedbackButton() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  function close() {
    setOpen(false);
    setError("");
    if (sent) {
      setSent(false);
      setMessage("");
    }
  }

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await sendFeedback({ message, email: user ? undefined : email, page: pathname, website });
      setSent(true);
    } catch (err) {
      setError(err.message || "Senden hat nicht geklappt.");
    } finally {
      setBusy(false);
    }
  }

  const input = "w-full border border-line rounded-2xl px-3 py-2 text-sm bg-canvas focus:outline-none focus:border-ink";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-4 right-4 z-40 flex items-center gap-1.5 bg-surface border border-line rounded-full px-3.5 py-2 text-xs font-medium shadow-md hover:border-ink"
      >
        <Icon name="message" className="w-4 h-4" />
        Feedback
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/40 backdrop-blur-sm"
          onMouseDown={(e) => e.target === e.currentTarget && close()}
        >
          <div className="w-full max-w-sm bg-surface border border-line rounded-3xl p-6 shadow-xl">
            {sent ? (
              <>
                <p className="font-semibold mb-1">Danke für dein Feedback!</p>
                <p className="text-subtle text-sm mb-5">
                  Wir lesen jede Nachricht und melden uns, wenn wir eine Rückfrage haben.
                </p>
                <button
                  type="button"
                  onClick={close}
                  className="w-full border border-line rounded-full py-2.5 text-sm hover:border-ink"
                >
                  Schließen
                </button>
              </>
            ) : (
              <form onSubmit={submit} className="space-y-3">
                <p className="font-semibold">Feedback geben</p>
                <p className="text-subtle text-xs">
                  Was gefällt dir, was fehlt, was funktioniert nicht? Jede Rückmeldung hilft.
                </p>
                <textarea
                  required
                  minLength={5}
                  maxLength={3000}
                  rows={5}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Deine Nachricht"
                  className={input}
                />
                {!user && (
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="E-Mail für Rückfragen (freiwillig)"
                    className={input}
                  />
                )}
                <input
                  type="text"
                  tabIndex={-1}
                  autoComplete="off"
                  aria-hidden="true"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  className="hidden"
                />
                <p className="text-subtle text-[11px]">
                  Wir bekommen deine Nachricht per E-Mail{user ? " mit deiner Konto-Adresse" : ""} und die
                  Seite, auf der du gerade bist. Mehr in der{" "}
                  <a href="/datenschutz" target="_blank" rel="noreferrer" className="underline hover:text-ink">
                    Datenschutzerklärung
                  </a>
                  .
                </p>
                {error && <p className="text-rose text-xs">{error}</p>}
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={close}
                    className="flex-1 border border-line rounded-full py-2.5 text-sm hover:border-ink"
                  >
                    Abbrechen
                  </button>
                  <button
                    type="submit"
                    disabled={busy || message.trim().length < 5}
                    className="flex-1 bg-yellow text-yellowInk rounded-full py-2.5 text-sm font-medium disabled:opacity-60"
                  >
                    {busy ? "Wird gesendet …" : "Senden"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
