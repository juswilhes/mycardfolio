import { useState } from "react";
import { resendVerification } from "../api.js";
import { inputCls } from "./AuthCard.jsx";

// "Bestätigungslink erneut senden" - ohne Anmeldung, nur mit der E-Mail-Adresse. Der Server
// antwortet immer gleich (verrät nicht, ob es ein Konto gibt). Ist die Adresse schon bekannt
// (nach der Registrierung, beim Anmelden), wird kein Eingabefeld gezeigt.
export default function ResendVerification({ email: known }) {
  const [email, setEmail] = useState(known || "");
  const [state, setState] = useState("idle"); // idle | busy | sent | error

  async function send(e) {
    e?.preventDefault();
    setState("busy");
    try {
      await resendVerification(email);
      setState("sent");
    } catch {
      setState("error");
    }
  }

  if (state === "sent") {
    return <p className="text-xs text-subtle">Falls es ein unbestätigtes Konto zu dieser Adresse gibt, ist ein neuer Link unterwegs.</p>;
  }
  return (
    <form onSubmit={send} className="space-y-2">
      {!known && (
        <input
          type="email" required placeholder="Deine E-Mail-Adresse" autoComplete="email"
          value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls}
        />
      )}
      <button type="submit" disabled={state === "busy" || !email} className="text-xs underline hover:text-ink disabled:opacity-60">
        {state === "busy" ? "Wird gesendet …" : "Bestätigungslink erneut senden"}
      </button>
      {state === "error" && <p className="text-rose text-xs">Das hat nicht geklappt, bitte später erneut versuchen.</p>}
    </form>
  );
}
