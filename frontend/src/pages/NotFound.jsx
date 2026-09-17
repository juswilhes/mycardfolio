import { Link } from "react-router-dom";

// Fängt jede Route auf, die es nicht gibt (alte Links, Tippfehler, ...).
// Der Server liefert dafür einen echten 404-Status, siehe server.js.
export default function NotFound() {
  return (
    <div className="text-center py-24">
      <p className="text-lg font-medium mb-1">Seite nicht gefunden</p>
      <p className="text-subtle mb-6">
        Diese Seite gibt es nicht (mehr). Vielleicht ist der Link veraltet.
      </p>
      <Link to="/sets" className="inline-block bg-yellow text-yellowInk font-medium px-5 py-2.5 rounded-full">
        Zurück zu Alle Karten
      </Link>
    </div>
  );
}
