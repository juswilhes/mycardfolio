import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { verifyEmail } from "../api.js";
import { useAuth } from "../context/AuthContext.jsx";
import AuthCard, { primaryBtn } from "../components/AuthCard.jsx";
import ResendVerification from "../components/ResendVerification.jsx";

// Ziel des Bestätigungslinks: bestätigt die Adresse und meldet direkt an (der Server setzt die Sitzung).
export default function VerifyEmail() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const { refresh } = useAuth();
  const [state, setState] = useState("pending"); // pending | ok | error
  const [message, setMessage] = useState("");
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    done.current = true;
    if (!token) {
      setState("error");
      setMessage("Der Bestätigungslink ist unvollständig.");
      return;
    }
    verifyEmail(token)
      .then(() => refresh())
      .then(() => setState("ok"))
      .catch((err) => {
        setState("error");
        setMessage(err.message);
      });
  }, [token, refresh]);

  return (
    <AuthCard
      title="E-Mail bestätigen"
      footer={<Link to="/login" className="underline hover:text-ink">Zur Anmeldung</Link>}
    >
      {state === "pending" && <p className="text-sm text-subtle">Einen Moment …</p>}
      {state === "ok" && (
        <>
          <p className="text-sm mb-4">Danke – deine E-Mail-Adresse ist bestätigt und du bist angemeldet.</p>
          <Link to="/sets" className={`${primaryBtn} block text-center`}>
            Erste Karten eintragen
          </Link>
        </>
      )}
      {state === "error" && (
        <>
          <p className="text-sm text-rose mb-4">{message}</p>
          <p className="text-xs text-subtle mb-2">Gib deine E-Mail-Adresse ein, dann schicken wir dir einen neuen Link:</p>
          <ResendVerification />
        </>
      )}
    </AuthCard>
  );
}
