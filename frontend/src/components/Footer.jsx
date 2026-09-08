import { Link } from "react-router-dom";

// Fuss der Seite: Pflicht-Links (Impressum, Datenschutz) plus der
// Marken-Disclaimer - mycardfolio ist ein unabhaengiges Fan-Projekt.
export default function Footer() {
  return (
    <footer className="border-t border-line mt-16 px-6 py-8 text-xs text-subtle">
      <div className="max-w-5xl mx-auto flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p>© {new Date().getFullYear()} mycardfolio</p>
        <nav className="flex flex-wrap gap-x-5 gap-y-1">
          <Link to="/impressum" className="hover:text-ink">Impressum</Link>
          <Link to="/datenschutz" className="hover:text-ink">Datenschutz</Link>
        </nav>
      </div>
      <p className="max-w-5xl mx-auto mt-4 leading-relaxed">
        mycardfolio ist ein privates, unabhängiges Projekt und steht in keiner
        Verbindung zu Nintendo, The Pokémon Company, Creatures Inc. oder GAME
        FREAK inc. und wird von diesen weder unterstützt noch gesponsert.
        „Pokémon" sowie alle Kartennamen, Bilder und zugehörigen Zeichen sind
        Marken bzw. urheberrechtlich geschützte Werke ihrer jeweiligen
        Rechteinhaber. Preisangaben sind unverbindliche Richtwerte ohne Gewähr.
      </p>
    </footer>
  );
}
