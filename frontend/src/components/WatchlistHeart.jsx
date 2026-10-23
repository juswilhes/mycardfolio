import { useState } from "react";
import { addToWatchlist, removeFromWatchlist } from "../api.js";

// Herzchen zum Merken einer Karte, unabhängig von der eigenen Sammlung.
// Steuert seinen "watched"-Zustand über die Eltern-Komponente (onChange),
// damit Listen mit vielen Karten nicht jede ihren eigenen Fetch machen.
export default function WatchlistHeart({ externalId, watched, onChange, className = "" }) {
  const [busy, setBusy] = useState(false);

  async function toggle(e) {
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;
    setBusy(true);
    try {
      if (watched) {
        await removeFromWatchlist(externalId);
        onChange(false);
      } else {
        await addToWatchlist(externalId);
        onChange(true);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      onClick={toggle}
      disabled={busy}
      aria-label={watched ? "Von der Watchlist entfernen" : "Zur Watchlist hinzufügen"}
      title={watched ? "Von der Watchlist entfernen" : "Zur Watchlist hinzufügen"}
      className={`leading-none transition disabled:opacity-50 ${
        watched ? "text-rose" : "text-ink hover:text-rose"
      } ${className}`}
    >
      {/* Vektor-Herz statt Schriftzeichen: das dünne "♡" war auf Kartenbildern kaum zu sehen (Justus 23.10.2026) */}
      <svg viewBox="0 0 24 24" className="w-[62%] h-[62%]" fill={watched ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 20.5s-7.5-4.6-9.3-9.6A5 5 0 0 1 12 7.6a5 5 0 0 1 9.3 3.3C19.5 15.9 12 20.5 12 20.5z" />
      </svg>
    </button>
  );
}
