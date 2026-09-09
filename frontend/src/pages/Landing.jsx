import { Link } from "react-router-dom";
import Logo from "../components/Logo.jsx";
import { useAuth } from "../context/AuthContext.jsx";

const FEATURES = [
  {
    title: "Preise & Wertverlauf",
    text: "Aktuelle Cardmarket-Trendpreise in Euro, dazu der Wert deines Portfolios über die Zeit als Graph.",
  },
  {
    title: "Kauf & Verkauf",
    text: "Kaufpreis inkl. Versand erfassen, Karten als verkauft markieren – realisierter Gewinn/Verlust inklusive.",
  },
  {
    title: "Set-Fortschritt & Statistik",
    text: "Sieh auf einen Blick, wie viele Karten dir zu jedem Set fehlen, plus Auswertungen deiner Sammlung.",
  },
  {
    title: "Massen-Import",
    text: "Excel-Tabelle einfügen – mycardfolio erkennt Name, Nummer, Menge und Preis automatisch.",
  },
];

// Öffentliche Startseite für nicht angemeldete Besucher (und Suchmaschinen).
export default function Landing() {
  const { registrationOpen } = useAuth();

  return (
    <div className="max-w-3xl mx-auto">
      <section className="text-center pt-6 pb-12">
        <Logo className="h-12 inline-block mb-8" />
        <h1 className="text-3xl sm:text-4xl font-semibold leading-tight">
          Deine Pokémon-Sammlung, den Wert immer im Blick
        </h1>
        <p className="text-subtle mt-4 max-w-xl mx-auto">
          mycardfolio verwaltet deine Sammelkarten, zeigt aktuelle
          Cardmarket-Preise in Euro und wie sich dein Portfolio über die Zeit
          entwickelt.
        </p>

        <div className="flex items-center justify-center gap-3 mt-8">
          <Link
            to="/login"
            className="bg-yellow text-yellowInk font-medium px-6 py-3 rounded-full text-sm"
          >
            Anmelden
          </Link>
          {registrationOpen && (
            <Link
              to="/register"
              className="border border-line px-6 py-3 rounded-full text-sm hover:border-ink"
            >
              Konto erstellen
            </Link>
          )}
        </div>
        {!registrationOpen && (
          <p className="text-xs text-subtle mt-3">
            Neue Anmeldungen sind gerade geschlossen.
          </p>
        )}
      </section>

      <section className="grid sm:grid-cols-2 gap-4">
        {FEATURES.map((f) => (
          <div
            key={f.title}
            className="bg-surface border border-line rounded-2xl p-5 shadow-sm"
          >
            <h2 className="font-medium mb-1">{f.title}</h2>
            <p className="text-subtle text-sm leading-relaxed">{f.text}</p>
          </div>
        ))}
      </section>

      <p className="text-xs text-subtle text-center mt-10">
        Unabhängiges Fan-Projekt – nicht verbunden mit Nintendo, The Pokémon
        Company, Creatures Inc. oder GAME FREAK inc.
      </p>
    </div>
  );
}
