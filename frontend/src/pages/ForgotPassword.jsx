import { useState } from "react";
import { Link } from "react-router-dom";
import { requestPasswordReset } from "../api.js";
import AuthCard, { inputCls, primaryBtn } from "../components/AuthCard.jsx";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await requestPasswordReset(email);
    } catch {
      /* absichtlich keine Fehlermeldung – verrät nicht, ob die Adresse existiert */
    }
    setSent(true);
    setBusy(false);
  }

  return (
    <AuthCard
      title="Passwort zurücksetzen"
      footer={<Link to="/login" className="underline hover:text-ink">Zurück zur Anmeldung</Link>}
    >
      {sent ? (
        <p className="text-sm text-subtle">
          Wenn ein Konto zu dieser Adresse existiert, ist eine E-Mail mit einem
          Link zum Zurücksetzen unterwegs. Prüfe auch den Spam-Ordner.
        </p>
      ) : (
        <form onSubmit={submit} className="space-y-3">
          <label className="block text-xs text-subtle">
            E-Mail
            <input
              type="email" autoComplete="email" required
              value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls}
            />
          </label>
          <button type="submit" disabled={busy} className={primaryBtn}>
            {busy ? "Wird gesendet …" : "Link anfordern"}
          </button>
        </form>
      )}
    </AuthCard>
  );
}
