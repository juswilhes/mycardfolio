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
        watched ? "text-rose" : "text-subtle hover:text-rose"
      } ${className}`}
    >
      {watched ? "♥" : "♡"}
    </button>
  );
}
