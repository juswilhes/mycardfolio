import { Routes, Route, NavLink, Link, Navigate, useLocation } from "react-router-dom";
import Logo from "./components/Logo.jsx";
import Collection from "./pages/Collection.jsx";
import AddCard from "./pages/AddCard.jsx";
import CardDetail from "./pages/CardDetail.jsx";
import Sets from "./pages/Sets.jsx";
import SetDetail from "./pages/SetDetail.jsx";
import CardInfo from "./pages/CardInfo.jsx";
import Sales from "./pages/Sales.jsx";
import Stats from "./pages/Stats.jsx";
import Import from "./pages/Import.jsx";
import Impressum from "./pages/Impressum.jsx";
import Datenschutz from "./pages/Datenschutz.jsx";
import Login from "./pages/Login.jsx";
import Register from "./pages/Register.jsx";
import ForgotPassword from "./pages/ForgotPassword.jsx";
import ResetPassword from "./pages/ResetPassword.jsx";
import VerifyEmail from "./pages/VerifyEmail.jsx";
import Account from "./pages/Account.jsx";
import Footer from "./components/Footer.jsx";
import { useTheme } from "./hooks/useTheme.js";
import { useAuth } from "./context/AuthContext.jsx";

const navCls = ({ isActive }) =>
  isActive ? "text-ink font-medium" : "text-subtle hover:text-ink";

function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return children;
}

export default function App() {
  const { isDark, toggleTheme } = useTheme();
  const { user, loading, logout } = useAuth();

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-line px-6 py-4 flex items-center justify-between">
        <Link to="/" aria-label="mycardfolio – Startseite">
          <Logo className="h-11" />
        </Link>
        <div className="flex items-center gap-6">
          {user && (
            <nav className="flex gap-6 text-sm">
              <NavLink to="/" end id="nav-sammlung" className={navCls}>Sammlung</NavLink>
              <NavLink to="/sets" className={navCls}>Alle Karten</NavLink>
              <NavLink to="/add" className={navCls}>Hinzufügen</NavLink>
              <NavLink to="/verkauft" className={navCls}>Verkauft</NavLink>
              <NavLink to="/statistik" className={navCls}>Statistik</NavLink>
            </nav>
          )}
          {!loading &&
            (user ? (
              <div className="flex items-center gap-3 text-sm">
                <NavLink to="/konto" className={navCls} title={user.email}>Konto</NavLink>
                <button onClick={logout} className="text-subtle hover:text-ink">Abmelden</button>
              </div>
            ) : (
              <div className="flex items-center gap-3 text-sm">
                <NavLink to="/login" className={navCls}>Anmelden</NavLink>
                <Link to="/register" className="bg-yellow text-yellowInk font-medium px-3 py-1.5 rounded-full">
                  Registrieren
                </Link>
              </div>
            ))}
          <button
            onClick={toggleTheme}
            aria-label="Hell-/Dunkelmodus wechseln"
            className="w-8 h-8 flex items-center justify-center rounded-full border border-line text-sm"
          >
            {isDark ? "☀︎" : "☾"}
          </button>
        </div>
      </header>

      <main className="px-6 py-8 max-w-5xl mx-auto w-full flex-1">
        <Routes>
          {/* Öffentlich */}
          <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
          <Route path="/register" element={user ? <Navigate to="/" replace /> : <Register />} />
          <Route path="/passwort-vergessen" element={<ForgotPassword />} />
          <Route path="/passwort-zuruecksetzen" element={<ResetPassword />} />
          <Route path="/verify" element={<VerifyEmail />} />
          <Route path="/impressum" element={<Impressum />} />
          <Route path="/datenschutz" element={<Datenschutz />} />

          {/* Nur mit Login */}
          <Route path="/" element={<RequireAuth><Collection /></RequireAuth>} />
          <Route path="/card/:cardId" element={<RequireAuth><CardDetail /></RequireAuth>} />
          <Route path="/add" element={<RequireAuth><AddCard /></RequireAuth>} />
          <Route path="/import" element={<RequireAuth><Import /></RequireAuth>} />
          <Route path="/verkauft" element={<RequireAuth><Sales /></RequireAuth>} />
          <Route path="/statistik" element={<RequireAuth><Stats /></RequireAuth>} />
          <Route path="/sets" element={<RequireAuth><Sets /></RequireAuth>} />
          <Route path="/sets/:setId" element={<RequireAuth><SetDetail /></RequireAuth>} />
          <Route path="/database/:externalId" element={<RequireAuth><CardInfo /></RequireAuth>} />
          <Route path="/konto" element={<RequireAuth><Account /></RequireAuth>} />
        </Routes>
      </main>

      <Footer />
    </div>
  );
}
