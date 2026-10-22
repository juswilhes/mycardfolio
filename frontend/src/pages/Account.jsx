import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { useTheme } from "../hooks/useTheme.js";
import ConfirmDialog from "../components/ConfirmDialog.jsx";
import {
  updateProfile,
  setNewsletter,
  deleteAccount,
  exportDataUrl,
} from "../api.js";

export default function Account() {
  const { user, setUser, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [name, setName] = useState(user?.username || "");
  const [savedName, setSavedName] = useState(false);
  const [nameErr, setNameErr] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [pw, setPw] = useState("");
  const [delErr, setDelErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function saveName(e) {
    e.preventDefault();
    setNameErr("");
    try {
      const u = await updateProfile(name.trim());
      setUser(u);
      setSavedName(true);
      setTimeout(() => setSavedName(false), 2000);
    } catch (err) {
      setNameErr(err.message);
    }
  }

  async function toggleNewsletter() {
    setUser(await setNewsletter(!user.newsletter));
  }

  async function doDelete() {
    setBusy(true);
    setDelErr("");
    try {
      await deleteAccount(pw || undefined);
      setUser(null);
      navigate("/register", { replace: true });
    } catch (err) {
      setDelErr(err.message);
      setBusy(false);
    }
  }

  if (!user) return null;

  return (
    <div className="max-w-lg">
      <h1 className="text-xl font-semibold mb-6">Konto</h1>

      <section className="mb-8">
        <p className="text-sm text-subtle">Angemeldet als</p>
        <p className="font-medium">{user.username || "Noch kein Benutzername"}</p>
        <p className="text-sm text-subtle">{user.email}</p>
      </section>

      <section className="mb-8">
        <h2 className="text-sm font-semibold mb-2">Darstellung</h2>
        <div className="flex items-center justify-between max-w-xs">
          <p className="text-sm text-subtle">{isDark ? "Dunkelmodus" : "Hellmodus"}</p>
          <button
            onClick={toggleTheme}
            role="switch"
            aria-checked={isDark}
            aria-label="Hell-/Dunkelmodus wechseln"
            className={`relative w-11 h-6 rounded-full transition-colors ${isDark ? "bg-ink" : "bg-line"}`}
          >
            <span
              className={`absolute top-0.5 w-5 h-5 rounded-full bg-surface shadow transition-transform ${
                isDark ? "translate-x-[22px]" : "translate-x-0.5"
              }`}
            />
          </button>
        </div>
      </section>

      <form onSubmit={saveName} className="mb-8">
        <label className="block text-xs text-subtle">
          Benutzername (3–20 Zeichen, auf mycardfolio nur einmal vergeben)
          <input
            type="text" required minLength={3} maxLength={20} pattern="[A-Za-z0-9][A-Za-z0-9_.\-]{2,19}"
            value={name} onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full border border-line rounded-xl px-3 py-2 text-sm bg-canvas text-ink focus:outline-none focus:border-ink"
          />
        </label>
        {nameErr && <p className="text-rose text-xs mt-1">{nameErr}</p>}
        <button className="mt-2 text-sm border border-line rounded-full px-4 py-1.5 hover:border-ink">
          {savedName ? "Gespeichert ✓" : "Speichern"}
        </button>
      </form>

      <section className="mb-8">
        <h2 className="text-sm font-semibold mb-1">Deine Daten</h2>
        <p className="text-xs text-subtle mb-2">
          Vollständiger Export als JSON (Konto, Sammlung, Verkäufe, Wertverlauf).
        </p>
        <a
          href={exportDataUrl}
          className="inline-block text-sm border border-line rounded-full px-4 py-1.5 hover:border-ink"
        >
          Daten exportieren
        </a>
      </section>

      <section className="mb-8">
        <h2 className="text-sm font-semibold mb-1">E-Mail-Neuigkeiten</h2>
        <div className="flex items-center justify-between gap-4 max-w-md">
          <p className="text-xs text-subtle">
            Gelegentlich Neuigkeiten zu mycardfolio per E-Mail (z. B. neue Funktionen und Aktionen).
            Abmeldung jederzeit.
          </p>
          <button
            onClick={toggleNewsletter}
            role="switch"
            aria-checked={!!user.newsletter}
            aria-label="E-Mail-Neuigkeiten an oder aus"
            className={`relative shrink-0 w-11 h-6 rounded-full transition-colors ${user.newsletter ? "bg-ink" : "bg-line"}`}
          >
            <span
              className={`absolute top-0.5 w-5 h-5 rounded-full bg-surface shadow transition-transform ${
                user.newsletter ? "translate-x-[22px]" : "translate-x-0.5"
              }`}
            />
          </button>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-sm font-semibold mb-1">Rechtliches</h2>
        <p className="text-xs text-subtle mb-2">
          Die Bedingungen für dein Konto und wie wir mit deinen Daten umgehen.
        </p>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/nutzungsbedingungen"
            className="inline-block text-sm border border-line rounded-full px-4 py-1.5 hover:border-ink"
          >
            Nutzungsbedingungen
          </Link>
          <Link
            to="/datenschutz"
            className="inline-block text-sm border border-line rounded-full px-4 py-1.5 hover:border-ink"
          >
            Datenschutzerklärung
          </Link>
        </div>
      </section>

      <section className="mb-8">
        <button
          onClick={() => setConfirmLogout(true)}
          className="text-sm border border-line rounded-full px-4 py-1.5 hover:border-ink"
        >
          Abmelden
        </button>
      </section>

      {confirmLogout && (
        <ConfirmDialog
          title="Wirklich abmelden?"
          message="Du kannst dich jederzeit wieder anmelden."
          confirmLabel="Abmelden"
          onConfirm={logout}
          onClose={() => setConfirmLogout(false)}
        />
      )}

      <section className="border-t border-line pt-6">
        <h2 className="text-sm font-semibold text-rose mb-1">Konto löschen</h2>
        <p className="text-xs text-subtle mb-3">
          Löscht dein Konto und alle zugehörigen Daten (Sammlung, Verkäufe,
          Wertverlauf) unwiderruflich.
        </p>
        {!confirmDelete ? (
          <button
            onClick={() => setConfirmDelete(true)}
            className="text-sm border border-rose text-rose rounded-full px-4 py-1.5 hover:bg-rose hover:text-white transition"
          >
            Konto löschen
          </button>
        ) : (
          <div className="space-y-2">
            <input
              type="password" placeholder="Passwort zur Bestätigung"
              value={pw} onChange={(e) => setPw(e.target.value)}
              className="w-full border border-line rounded-xl px-3 py-2 text-sm bg-canvas text-ink focus:outline-none focus:border-rose"
            />
            {delErr && <p className="text-rose text-xs">{delErr}</p>}
            <div className="flex gap-2">
              <button
                onClick={doDelete} disabled={busy}
                className="text-sm bg-rose text-white rounded-full px-4 py-1.5 disabled:opacity-60"
              >
                {busy ? "Wird gelöscht …" : "Endgültig löschen"}
              </button>
              <button
                onClick={() => { setConfirmDelete(false); setPw(""); setDelErr(""); }}
                className="text-sm text-subtle px-3"
              >
                Abbrechen
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
