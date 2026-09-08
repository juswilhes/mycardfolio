import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { resetPassword } from "../api.js";
import { useAuth } from "../context/AuthContext.jsx";
import AuthCard, { inputCls, primaryBtn } from "../components/AuthCard.jsx";

export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const { refresh } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await resetPassword(token, password);
      await refresh();
      navigate("/", { replace: true });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <AuthCard
      title="Neues Passwort festlegen"
      footer={<Link to="/login" className="underline hover:text-ink">Zur Anmeldung</Link>}
    >
      {!token ? (
        <p className="text-sm text-rose">Der Link ist unvollständig. Bitte fordere einen neuen an.</p>
      ) : (
        <form onSubmit={submit} className="space-y-3">
          <label className="block text-xs text-subtle">
            Neues Passwort (mind. 8 Zeichen)
            <input
              type="password" autoComplete="new-password" required minLength={8}
              value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls}
            />
          </label>
          {error && <p className="text-rose text-xs">{error}</p>}
          <button type="submit" disabled={busy} className={primaryBtn}>
            {busy ? "Wird gespeichert …" : "Passwort speichern"}
          </button>
        </form>
      )}
    </AuthCard>
  );
}
