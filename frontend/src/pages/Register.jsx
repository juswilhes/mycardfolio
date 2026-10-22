import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import AuthCard, { inputCls, primaryBtn } from "../components/AuthCard.jsx";

export default function Register() {
  const { register, registrationOpen } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "", password2: "", displayName: "" });
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    if (!accepted) return;
    if (form.password !== form.password2) {
      setError("Die beiden Passwörter stimmen nicht überein.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await register({
        email: form.email,
        password: form.password,
        displayName: form.displayName.trim() || undefined,
        acceptTerms: true,
      });
      navigate("/", { replace: true });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  if (!registrationOpen) {
    return (
      <AuthCard
        title="Registrierung geschlossen"
        footer={
          <>
            Schon ein Konto? <Link to="/login" className="underline hover:text-ink">Anmelden</Link>
          </>
        }
      >
        <p className="text-sm text-subtle">
          mycardfolio nimmt gerade keine neuen Anmeldungen an. Schau bald wieder
          vorbei.
        </p>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Konto erstellen"
      footer={
        <>
          Schon ein Konto? <Link to="/login" className="underline hover:text-ink">Anmelden</Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-3">
        <label className="block text-xs text-subtle">
          E-Mail
          <input
            type="email" autoComplete="email" required
            value={form.email} onChange={set("email")} className={inputCls}
          />
        </label>
        <label className="block text-xs text-subtle">
          Anzeigename (optional)
          <input
            type="text" autoComplete="nickname" maxLength={60}
            value={form.displayName} onChange={set("displayName")} className={inputCls}
          />
        </label>
        <label className="block text-xs text-subtle">
          Passwort (mind. 8 Zeichen)
          <input
            type="password" autoComplete="new-password" required minLength={8}
            value={form.password} onChange={set("password")} className={inputCls}
          />
        </label>
        <label className="block text-xs text-subtle">
          Passwort wiederholen
          <input
            type="password" autoComplete="new-password" required minLength={8}
            value={form.password2} onChange={set("password2")} className={inputCls}
          />
        </label>
        {form.password2 && form.password !== form.password2 && (
          <p className="text-rose text-xs">Die beiden Passwörter stimmen nicht überein.</p>
        )}
        <label className="flex items-start gap-2 text-xs text-subtle">
          <input
            type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)}
            className="mt-0.5 shrink-0"
          />
          <span>
            Ich akzeptiere die{" "}
            <Link to="/nutzungsbedingungen" target="_blank" className="underline hover:text-ink">
              Nutzungsbedingungen
            </Link>{" "}
            und habe die{" "}
            <Link to="/datenschutz" target="_blank" className="underline hover:text-ink">
              Datenschutzerklärung
            </Link>{" "}
            gelesen.
          </span>
        </label>
        {error && <p className="text-rose text-xs">{error}</p>}
        <button type="submit" disabled={busy || !accepted || form.password !== form.password2} className={primaryBtn}>
          {busy ? "Wird erstellt …" : "Konto erstellen"}
        </button>
      </form>
    </AuthCard>
  );
}
