import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import AuthCard, { inputCls, primaryBtn } from "../components/AuthCard.jsx";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await login(email, password);
      navigate(location.state?.from || "/", { replace: true });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <AuthCard
      title="Anmelden"
      footer={
        <>
          Noch kein Konto? <Link to="/register" className="underline hover:text-ink">Registrieren</Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-3">
        <label className="block text-xs text-subtle">
          E-Mail
          <input
            type="email" autoComplete="email" required
            value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls}
          />
        </label>
        <label className="block text-xs text-subtle">
          Passwort
          <input
            type="password" autoComplete="current-password" required
            value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls}
          />
        </label>
        {error && <p className="text-rose text-xs">{error}</p>}
        <button type="submit" disabled={busy} className={primaryBtn}>
          {busy ? "Anmelden …" : "Anmelden"}
        </button>
      </form>
      <p className="text-xs text-subtle mt-4">
        <Link to="/passwort-vergessen" className="underline hover:text-ink">Passwort vergessen?</Link>
      </p>
    </AuthCard>
  );
}
