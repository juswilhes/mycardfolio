import { useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { resendVerification } from "../api.js";

// Hinweis oben auf jeder Seite, solange die E-Mail-Adresse nicht bestätigt ist. Unbestätigte Konten
// sind voll nutzbar, werden aber ohne Einträge nach 30 Tagen gelöscht (services/dataRetention.js) -
// und erst nach der Bestätigung kommt die Willkommens-Mail.
export default function VerifyBanner() {
  const { user } = useAuth();
  const [state, setState] = useState("idle"); // idle | busy | sent | error
  if (!user || user.email_verified) return null;

  async function resend() {
    setState("busy");
    try {
      await resendVerification();
      setState("sent");
    } catch {
      setState("error");
    }
  }

  return (
    <div className="mb-6 text-sm bg-yellow/10 border border-yellow rounded-2xl px-4 py-3">
      <strong>Bitte bestätige deine E-Mail-Adresse.</strong> Wir haben dir einen Link an{" "}
      <span className="font-medium">{user.email}</span> geschickt (schau auch im Spam-Ordner nach).{" "}
      {state === "sent" ? (
        <span className="text-subtle">Neuer Link ist unterwegs.</span>
      ) : state === "error" ? (
        <span className="text-rose">Senden hat nicht geklappt, bitte später erneut versuchen.</span>
      ) : (
        <button onClick={resend} disabled={state === "busy"} className="underline hover:text-ink disabled:opacity-60">
          Link erneut senden
        </button>
      )}
    </div>
  );
}
