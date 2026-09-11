import { Link } from "react-router-dom";
import Logo from "../components/Logo.jsx";
import { useAuth } from "../context/AuthContext.jsx";

const FEATURES = [
  {
    title: "Cardmarket-Preise in Euro",
    text: "Trendpreise direkt von Cardmarket, regelmäßig aktualisiert – normal und Holo getrennt, mit Direktlink zum Angebot.",
  },
  {
    title: "Wertverlauf deines Portfolios",
    text: "Jeder Kauf zählt: Kaufpreis inkl. Versand erfassen und sehen, wie sich der Wert deiner ganzen Sammlung über die Zeit entwickelt.",
  },
  {
    title: "Kauf & Verkauf",
    text: "Karten als verkauft markieren statt zu löschen – realisierter Gewinn/Verlust und deine Verkaufshistorie bleiben erhalten.",
  },
  {
    title: "Set-Fortschritt",
    text: 'Sieh pro Set auf einen Blick, wie viele Karten dir noch fehlen – mit Fortschrittsbalken und Filter „Fehlt mir".',
  },
  {
    title: "Massen-Import",
    text: "Excel-Tabelle einfach einfügen – mycardfolio erkennt Name, Nummer, Menge und Preis automatisch, egal wie deine Tabelle aufgebaut ist.",
  },
  {
    title: "Karten-Datenbank durchsuchen",
    text: "Über 20.000 Karten, deutsche Namen inklusive – zum Nachschlagen brauchst du gar kein Konto.",
  },
];

const STEPS = [
  ["Suchen", "Karte per Name, deutschem Namen oder Nummer finden – sofort, ohne Anmeldung."],
  ["Erfassen", "Kaufpreis, Zustand und Menge eintragen. Ein Konto reicht, keine Kreditkarte."],
  ["Im Blick behalten", "Aktuelle Cardmarket-Preise, Gewinn/Verlust und Set-Fortschritt auf einen Blick."],
];

// Öffentliche Startseite für nicht angemeldete Besucher (und Suchmaschinen).
// Die Suche selbst lebt auf "Alle Karten" (oben in der Kopfzeile) – hier
// nur der Pitch + Link dorthin, damit es nicht zwei Suchfelder gibt.
export default function Landing() {
  const { registrationOpen } = useAuth();

  return (
    <div className="max-w-4xl mx-auto">
      <section className="text-center pt-6 pb-10">
        <Logo className="h-12 inline-block mb-8" />
        <h1 className="text-3xl sm:text-4xl font-semibold leading-tight">
          Deine Pokémon-Sammlung, den Wert immer im Blick
        </h1>
        <p className="text-subtle mt-4 max-w-xl mx-auto">
          mycardfolio verwaltet deine Sammelkarten, zeigt aktuelle
          Cardmarket-Preise in Euro und wie sich dein Portfolio über die Zeit
          entwickelt.
        </p>

        <div className="flex items-center justify-center gap-3 mt-7">
          <Link
            to="/sets"
            className="bg-yellow text-yellowInk font-medium px-6 py-3 rounded-full text-sm"
          >
            Karten durchsuchen
          </Link>
        </div>
        <p className="text-xs text-subtle mt-2">Kostenlos, sofort, ganz ohne Konto.</p>

        <div className="flex items-center justify-center gap-3 mt-6">
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
              Kostenloses Konto erstellen
            </Link>
          )}
        </div>
        {!registrationOpen && (
          <p className="text-xs text-subtle mt-3">
            Neue Anmeldungen sind gerade geschlossen – die Kartensuche steht dir trotzdem offen.
          </p>
        )}
      </section>

      <section className="mb-14">
        <h2 className="text-center text-sm font-medium text-subtle mb-6">So funktioniert's</h2>
        <div className="grid sm:grid-cols-3 gap-4">
          {STEPS.map(([title, text], i) => (
            <div key={title} className="text-center">
              <div className="w-8 h-8 rounded-full bg-yellow text-yellowInk font-mono font-semibold flex items-center justify-center mx-auto mb-3">
                {i + 1}
              </div>
              <h3 className="font-medium mb-1">{title}</h3>
              <p className="text-subtle text-sm leading-relaxed">{text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
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
        Company, Creatures Inc. oder GAME FREAK inc. Preisangaben sind
        Cardmarket-Trendwerte, unverbindlich und ohne Gewähr.
      </p>
    </div>
  );
}
