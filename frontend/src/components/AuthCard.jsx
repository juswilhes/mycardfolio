import { Link } from "react-router-dom";
import Logo from "./Logo.jsx";

// Schmale, zentrierte Karte für Login / Registrierung / Passwort.
export default function AuthCard({ title, children, footer }) {
  return (
    <div className="max-w-sm mx-auto py-8">
      <Link to="/" className="block mb-8 text-center">
        <Logo className="h-10 inline-block" />
      </Link>
      <div className="bg-surface border border-line rounded-2xl p-6 shadow-sm">
        <h1 className="text-lg font-semibold mb-5">{title}</h1>
        {children}
      </div>
      {footer && <div className="text-sm text-subtle text-center mt-5">{footer}</div>}
    </div>
  );
}

export const inputCls =
  "mt-1 w-full border border-line rounded-xl px-3 py-2 text-sm bg-white text-[#241c15] placeholder:text-[#8a7a63] focus:outline-none focus:border-ink";

export const primaryBtn =
  "w-full bg-yellow text-yellowInk font-medium rounded-full py-2.5 text-sm disabled:opacity-60";
