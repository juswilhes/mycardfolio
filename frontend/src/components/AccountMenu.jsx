import { useEffect, useRef, useState } from "react";
import { NavLink } from "react-router-dom";
import { UserIcon } from "./icons.jsx";

// Konto-Icon im Header mit Dropdown (Konto / Abmelden), statt eines
// eigenen sichtbaren "Abmelden"-Textlinks daneben.
export default function AccountMenu({ email, onLogout }) {
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

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        title={email}
        aria-haspopup="true"
        aria-expanded={open}
        className={`w-8 h-8 flex items-center justify-center rounded-full border ${
          open ? "border-ink text-ink" : "border-line text-subtle hover:text-ink"
        }`}
      >
        <UserIcon className="w-4 h-4" />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-44 bg-surface border border-line rounded-xl shadow-lg py-1 z-50 text-sm">
          {email && (
            <p className="px-3 py-1.5 text-xs text-subtle truncate border-b border-line mb-1">{email}</p>
          )}
          <NavLink
            to="/konto"
            onClick={() => setOpen(false)}
            className={({ isActive }) =>
              `block px-3 py-1.5 ${isActive ? "text-ink font-medium" : "text-subtle hover:text-ink"}`
            }
          >
            Konto
          </NavLink>
          <button
            onClick={() => {
              setOpen(false);
              onLogout();
            }}
            className="w-full text-left px-3 py-1.5 text-subtle hover:text-ink"
          >
            Abmelden
          </button>
        </div>
      )}
    </div>
  );
}
