import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import AuthCard, { inputCls, primaryBtn } from "../components/AuthCard.jsx";
import ResendVerification from "../components/ResendVerification.jsx";

// Ablauf: Formular -> Konto wird angelegt, Bestätigungslink per E-Mail -> erst der Klick auf den
// Link meldet an (VerifyEmail.jsx). Ohne bestätigte Adresse ist keine Anmeldung möglich.
export default function Register() {
  const { register, registrationOpen, testers } = useAuth();
  const [form, setForm] = useState({ email: "", username: "", password: "", password2: "" });
  const [accepted, setAccepted] = useState(false);
  const [welcome, setWelcome] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sentTo, setSentTo] = useState(null);

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
      const r = await register({
        email: form.email,
        username: form.username.trim(),
        password: form.password,
        acceptTerms: true,
        newsletter: welcome,
      });
      setSentTo(r.email);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const footer = (
    <>
      Schon ein Konto? <Link to="/login" className="underline hover:text-ink">Anmelden</Link>
    </>
  );

  if (!registrationOpen) {
    return (
      <AuthCard title={testers?.full ? "Alle Testplätze vergeben" : "Registrierung geschlossen"} footer={footer}>
        <p className="text-sm text-subtle">
          {testers?.full
            ? `Die ${testers.limit} Plätze der Testphase sind vergeben. Schau bald wieder vorbei – danach öffnen wir für alle.`
            : "mycardfolio nimmt gerade keine neuen Anmeldungen an. Schau bald wieder vorbei."}
        </p>
      </AuthCard>
    );
  }

  if (sentTo) {
    return (
      <AuthCard title="Fast geschafft" footer={footer}>
        <p className="text-sm mb-3">
          Wir haben dir einen Link an <strong>{sentTo}</strong> geschickt. Klick darauf, um deine
          E-Mail-Adresse zu bestätigen – danach bist du direkt angemeldet.
        </p>
        <p className="text-xs text-subtle mb-4">
          Keine Mail da? Schau auch im Spam-Ordner nach. Der Link ist 24 Stunden gültig.
        </p>
        <ResendVerification email={sentTo} />
      </AuthCard>
    );
  }

  const mismatch = form.password2 && form.password !== form.password2;

  return (
    <AuthCard title="Konto erstellen" footer={footer}>
      {testers && (
        <p className="text-xs bg-yellow/10 border border-yellow rounded-xl px-3 py-2 mb-4">
          <strong>Testphase:</strong> nur {testers.limit} Plätze. Kostenlos, deine Wünsche haben Vorrang.
        </p>
      )}
      <form onSubmit={submit} className="space-y-3">
        <label className="block text-xs text-subtle">
          E-Mail
          <input
            type="email" autoComplete="email" required
            value={form.email} onChange={set("email")} className={inputCls}
          />
        </label>
        <label className="block text-xs text-subtle">
          Benutzername (3–20 Zeichen: Buchstaben, Ziffern, Punkt, Unterstrich, Bindestrich)
          <input
            type="text" autoComplete="username" required minLength={3} maxLength={20}
            pattern="[A-Za-z0-9][A-Za-z0-9_.\-]{2,19}"
            title="3–20 Zeichen: Buchstaben, Ziffern, Punkt, Unterstrich oder Bindestrich, ohne Leerzeichen und Umlaute"
            value={form.username} onChange={set("username")} className={inputCls}
          />
        </label>
        <label className="block text-xs text-subtle">
          Passwort (mind. 10 Zeichen)
          <input
            type="password" autoComplete="new-password" required minLength={10}
            value={form.password} onChange={set("password")} className={inputCls}
          />
        </label>
        <label className="block text-xs text-subtle">
          Passwort wiederholen
          <input
            type="password" autoComplete="new-password" required minLength={10}
            value={form.password2} onChange={set("password2")} className={inputCls}
          />
        </label>
        {mismatch && <p className="text-rose text-xs">Die beiden Passwörter stimmen nicht überein.</p>}
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
        <label className="flex items-start gap-2 text-xs text-subtle">
          <input
            type="checkbox" checked={welcome} onChange={(e) => setWelcome(e.target.checked)}
            className="mt-0.5 shrink-0"
          />
          <span>
            Freiwillig: Ja, schickt mir eine Willkommens-Mail und gelegentlich Neuigkeiten zu mycardfolio
            per E-Mail (z. B. neue Funktionen und Aktionen). Abmeldung jederzeit mit einem Klick.
          </span>
        </label>
        {error && <p className="text-rose text-xs">{error}</p>}
        <button type="submit" disabled={busy || !accepted || mismatch} className={primaryBtn}>
          {busy ? "Wird erstellt …" : "Konto erstellen"}
        </button>
      </form>
    </AuthCard>
  );
}
