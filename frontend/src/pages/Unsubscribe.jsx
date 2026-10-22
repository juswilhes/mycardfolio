import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { unsubscribe } from "../api.js";
import AuthCard from "../components/AuthCard.jsx";

// Ziel des Abmeldelinks aus E-Mails: widerruft die E-Mail-Einwilligung mit einem Klick, ohne Anmeldung.
export default function Unsubscribe() {
  const [params] = useSearchParams();
  const token = params.get("t") || "";
  const [state, setState] = useState("pending"); // pending | ok | error
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    done.current = true;
    unsubscribe(token)
      .then(() => setState("ok"))
      .catch(() => setState("error"));
  }, [token]);

  return (
    <AuthCard title="E-Mails abbestellen" footer={<Link to="/" className="underline hover:text-ink">Zur Startseite</Link>}>
      {state === "pending" && <p className="text-sm text-subtle">Einen Moment …</p>}
      {state === "ok" && (
        <p className="text-sm">
          Erledigt – du bekommst keine Neuigkeiten mehr von uns. Mails, die für dein Konto nötig sind
          (z. B. Passwort zurücksetzen), schicken wir weiterhin. Du kannst die Neuigkeiten jederzeit unter
          „Konto" wieder einschalten.
        </p>
      )}
      {state === "error" && (
        <p className="text-sm text-rose">
          Der Abmeldelink ist ungültig. Du kannst die Neuigkeiten auch unter „Konto" abschalten oder uns an
          info@mycardfolio.de schreiben.
        </p>
      )}
    </AuthCard>
  );
}
