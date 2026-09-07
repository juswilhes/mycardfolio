import { Routes, Route, NavLink, Link } from "react-router-dom";
import Logo from "./components/Logo.jsx";
import Collection from "./pages/Collection.jsx";
import AddCard from "./pages/AddCard.jsx";
import CardDetail from "./pages/CardDetail.jsx";
import Sets from "./pages/Sets.jsx";
import SetDetail from "./pages/SetDetail.jsx";
import CardInfo from "./pages/CardInfo.jsx";
import Sales from "./pages/Sales.jsx";
import { useTheme } from "./hooks/useTheme.js";

export default function App() {
  const { isDark, toggleTheme } = useTheme();

  return (
    <div className="min-h-screen">
      <header className="border-b border-line px-6 py-4 flex items-center justify-between">
        <Link to="/" aria-label="mycardfolio – Startseite">
          <Logo className="h-11" />
        </Link>
        <div className="flex items-center gap-6">
          <nav className="flex gap-6 text-sm">
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                isActive ? "text-ink font-medium" : "text-subtle hover:text-ink"
              }
            >
              Sammlung
            </NavLink>
            <NavLink
              to="/sets"
              className={({ isActive }) =>
                isActive ? "text-ink font-medium" : "text-subtle hover:text-ink"
              }
            >
              Alle Karten
            </NavLink>
            <NavLink
              to="/add"
              className={({ isActive }) =>
                isActive ? "text-ink font-medium" : "text-subtle hover:text-ink"
              }
            >
              Hinzufügen
            </NavLink>
            <NavLink
              to="/verkauft"
              className={({ isActive }) =>
                isActive ? "text-ink font-medium" : "text-subtle hover:text-ink"
              }
            >
              Verkauft
            </NavLink>
          </nav>
          {/* Ein Klick ruft toggleTheme() aus dem Hook auf, der Rest passiert automatisch */}
          <button
            onClick={toggleTheme}
            aria-label="Hell-/Dunkelmodus wechseln"
            className="w-8 h-8 flex items-center justify-center rounded-full border border-line text-sm"
          >
            {isDark ? "☀︎" : "☾"}
          </button>
        </div>
      </header>

      <main className="px-6 py-8 max-w-5xl mx-auto">
        <Routes>
          <Route path="/" element={<Collection />} />
          <Route path="/card/:cardId" element={<CardDetail />} />
          <Route path="/add" element={<AddCard />} />
          <Route path="/verkauft" element={<Sales />} />
          <Route path="/sets" element={<Sets />} />
          <Route path="/sets/:setId" element={<SetDetail />} />
          <Route path="/database/:externalId" element={<CardInfo />} />
        </Routes>
      </main>
    </div>
  );
}
