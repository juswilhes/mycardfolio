import { useEffect, useRef, useState } from "react";
import { NavLink } from "react-router-dom";

// Hauptnavigation als Dropdown (nur auf schmalen Screens sichtbar, ab "sm"
// übernimmt die normale Link-Zeile im Header) - vorher lief die komplette
// Nav als eine einzeilige Flex-Reihe ohne Umbruch und quetschte sich auf
// dem Handy zusammen bzw. wickelte unschön.
export default function NavMenu({ user, loading }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDocClick);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const items = [
    { to: "/sets", label: "Alle Karten" },
    { to: "/marktplatz", label: "🛒 Marktplatz" },
    { to: "/news", label: "📰 News" },
    ...(user
      ? [
          { to: "/", label: "Sammlung", end: true },
          { to: "/analyse", label: "Analyse" },
          { to: "/watchlist", label: "❤️ Watchlist" },
          { to: "/orden", label: "🏅 Orden" },
        ]
      : []),
    // "Anmelden" steht auf dem Handy nicht zusätzlich im Header (zu wenig
    // Platz neben Logo + "Registrieren"), sondern nur hier im Menü.
    ...(!loading && !user ? [{ to: "/login", label: "Anmelden" }] : []),
  ];

  return (
    <div className="relative sm:hidden" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Menü"
        aria-haspopup="true"
        aria-expanded={open}
        className={`w-9 h-9 flex items-center justify-center rounded-full border text-base ${
          open ? "border-ink text-ink" : "border-line text-subtle hover:text-ink"
        }`}
      >
        {open ? "✕" : "☰"}
      </button>

      {open && (
        <div className="absolute left-0 mt-2 w-52 bg-surface border border-line rounded-xl shadow-lg py-1 z-50 text-sm">
          {items.map(({ to, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `block px-3 py-2 ${isActive ? "text-ink font-medium" : "text-subtle hover:text-ink"}`
              }
            >
              {label}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );
}
