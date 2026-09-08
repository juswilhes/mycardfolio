import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { verifyEmail } from "../api.js";
import { useAuth } from "../context/AuthContext.jsx";
import AuthCard from "../components/AuthCard.jsx";

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
      footer={<Link to="/" className="underline hover:text-ink">Zur Sammlung</Link>}
    >
      {state === "pending" && <p className="text-sm text-subtle">Einen Moment …</p>}
      {state === "ok" && (
        <p className="text-sm">Danke – deine E-Mail-Adresse ist jetzt bestätigt. ✅</p>
      )}
      {state === "error" && <p className="text-sm text-rose">{message}</p>}
    </AuthCard>
  );
}
