import { useState } from "react";
import { Routes, Route, NavLink, Link, Navigate, useLocation } from "react-router-dom";
import Logo from "./components/Logo.jsx";
import ConfirmDialog from "./components/ConfirmDialog.jsx";
import Collection from "./pages/Collection.jsx";
import CardDetail from "./pages/CardDetail.jsx";
import AllCards from "./pages/AllCards.jsx";
import SetDetail from "./pages/SetDetail.jsx";
import CardInfo from "./pages/CardInfo.jsx";
import Landing from "./pages/Landing.jsx";
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
import Orden from "./pages/Orden.jsx";
import Watchlist from "./pages/Watchlist.jsx";
import Footer from "./components/Footer.jsx";
import AccountMenu from "./components/AccountMenu.jsx";
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
  const { user, loading, logout, registrationOpen } = useAuth();
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  async function doLogout() {
    setLoggingOut(true);
    try {
      await logout();
    } finally {
      setLoggingOut(false);
      setConfirmLogout(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-line px-6 py-4 flex items-center justify-between">
        <Link to="/" aria-label="mycardfolio – Startseite">
          <Logo className="h-11" />
        </Link>
        <div className="flex items-center gap-6">
          <nav className="flex gap-6 text-sm">
            <NavLink to="/sets" className={navCls}>Alle Karten</NavLink>
            {user && (
              <>
                <NavLink to="/" end id="nav-sammlung" className={navCls}>Sammlung</NavLink>
                <NavLink to="/statistik" className={navCls}>Statistik</NavLink>
                <NavLink to="/watchlist" className={navCls}>❤️ Watchlist</NavLink>
                <NavLink to="/orden" id="nav-orden" className={navCls}>🏅 Orden</NavLink>
              </>
            )}
          </nav>
          {!loading && !user && (
            <div className="flex items-center gap-3 text-sm">
              <NavLink to="/login" className={navCls}>Anmelden</NavLink>
              {registrationOpen && (
                <Link to="/register" className="bg-yellow text-yellowInk font-medium px-3 py-1.5 rounded-full">
                  Registrieren
                </Link>
              )}
            </div>
          )}
          <div className="flex items-center gap-2">
            {!loading && user && (
              <AccountMenu email={user.email} onLogout={() => setConfirmLogout(true)} />
            )}
            {/* Angemeldet: Hell-/Dunkelmodus lebt unter "Konto". Ohne Konto
                gibt es diese Seite nicht, deshalb hier der einzige Schalter. */}
            {!loading && !user && (
              <button
                onClick={toggleTheme}
                aria-label="Hell-/Dunkelmodus wechseln"
                className="w-8 h-8 flex items-center justify-center rounded-full border border-line text-sm"
              >
                {isDark ? "☀︎" : "☾"}
              </button>
            )}
          </div>
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

          {/* Kartensuche & -datenbank: auch ohne Konto nutzbar */}
          <Route path="/sets" element={<AllCards />} />
          <Route path="/sets/:setId" element={<SetDetail />} />
          <Route path="/database/:externalId" element={<CardInfo />} />
          {/* "Hinzufügen" ist jetzt Teil von "Alle Karten" */}
          <Route path="/add" element={<Navigate to="/sets" replace />} />

          {/* Startseite: öffentliche Landingpage, angemeldet die Sammlung */}
          <Route
            path="/"
            element={loading ? null : user ? <Collection /> : <Landing />}
          />

          {/* Nur mit Login */}
          <Route path="/card/:cardId" element={<RequireAuth><CardDetail /></RequireAuth>} />
          <Route path="/import" element={<RequireAuth><Import /></RequireAuth>} />
          <Route path="/verkauft" element={<RequireAuth><Sales /></RequireAuth>} />
          <Route path="/statistik" element={<RequireAuth><Stats /></RequireAuth>} />
          <Route path="/konto" element={<RequireAuth><Account /></RequireAuth>} />
          <Route path="/orden" element={<RequireAuth><Orden /></RequireAuth>} />
          <Route path="/watchlist" element={<RequireAuth><Watchlist /></RequireAuth>} />
        </Routes>
      </main>

      <Footer />

      {confirmLogout && (
        <ConfirmDialog
          title="Wirklich abmelden?"
          message="Du kannst dich jederzeit wieder anmelden."
          confirmLabel="Abmelden"
          busy={loggingOut}
          onConfirm={doLogout}
          onClose={() => !loggingOut && setConfirmLogout(false)}
        />
      )}
    </div>
  );
}
