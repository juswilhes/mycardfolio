import { Component } from "react";
import { reportError } from "../lib/reportError.js";

// Fängt Render-Fehler EINER Seite ab, statt dass die ganze App weiß bleibt
// und nur noch ein manuelles Neuladen hilft. App.jsx setzt hier den aktuellen
// Pfad als "key" - bei jedem Seitenwechsel wird diese Komponente frisch
// gemountet und bekommt dadurch automatisch eine neue Chance, statt im
// Fehlerzustand hängen zu bleiben.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("Unerwarteter Fehler beim Rendern:", error, info);
    reportError(error, { componentStack: info?.componentStack?.slice(0, 2000) });
  }

  render() {
    if (this.state.error) {
      return (
        <div className="text-center py-24 max-w-md mx-auto">
          <p className="text-lg font-medium mb-1">Etwas ist schiefgelaufen</p>
          <p className="text-subtle mb-6">
            Diese Seite konnte nicht angezeigt werden. Meistens hilft ein
            Neuladen - deine Daten sind davon nicht betroffen.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="inline-block bg-yellow text-yellowInk font-medium px-5 py-2.5 rounded-full"
          >
            Seite neu laden
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
