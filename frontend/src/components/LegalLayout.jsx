import { Link } from "react-router-dom";
import { LEGAL_REVIEWED, SITE } from "../lib/legal.js";

// Gemeinsames Layout für Impressum & Datenschutz: schmale Lesespalte,
// einheitliche Typo, und solange die Texte nicht geprüft/ausgefüllt sind
// ein deutlich sichtbarer Hinweis.
export default function LegalLayout({ title, children }) {
  return (
    <div className="max-w-2xl mx-auto">
      <Link to="/" className="text-sm text-subtle hover:text-ink">← Zurück</Link>
      <h1 className="text-2xl font-semibold mt-4 mb-6">{title}</h1>

      {!LEGAL_REVIEWED && (
        <div className="border border-yellow bg-yellow/10 text-sm rounded-xl px-4 py-3 mb-8">
          <strong>Entwurf – noch nicht rechtsverbindlich.</strong> Platzhalter in{" "}
          <code>src/lib/legal.js</code> ausfüllen und den Text vor dem Livegang
          fachkundig prüfen lassen.
        </div>
      )}

      <div className="legal-prose text-sm leading-relaxed text-ink space-y-4">
        {children}
      </div>

      <p className="text-xs text-subtle mt-10">
        Stand: {new Date(SITE.lastUpdated).toLocaleDateString("de-DE")}
      </p>
    </div>
  );
}
