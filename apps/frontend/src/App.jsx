import React, { useEffect, useState } from "react";
import { Link, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "./contexts/AuthContext.jsx";
import PoseSandbox from "./components/PoseSandbox.jsx";
import Login from "./pages/Login.jsx";
import Register from "./pages/Register.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Landing from "./pages/Landing.jsx";

function Header() {
  const { user, loading, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isLanding = location.pathname === "/" && !user;
  const [isMenuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  async function handleLogout() {
    await logout();
    navigate("/", { replace: true });
  }

  return (
    <header className={`header ${isMenuOpen ? "header--menu-open" : ""}`}>
      <div className="header-nav">
        <h1 style={{ margin: 0 }}>
          <Link to="/" style={{ color: "inherit", textDecoration: "none" }}>
            Calisthenics AI
          </Link>
        </h1>
        <button
          type="button"
          className="header-nav-toggle"
          aria-label="Ouvrir le menu"
          onClick={() => setMenuOpen((o) => !o)}
        >
          <span className="header-nav-toggle-bar" />
          <span className="header-nav-toggle-bar" />
          <span className="header-nav-toggle-bar" />
        </button>
        <div className="header-nav-links">
          {!loading && (
            <>
              <Link to="/accueil">Accueil</Link>
              {user ? <Link to="/">Dashboard</Link> : null}
              <Link to="/analyze">Analyser une figure</Link>
              {user ? (
                <>
                  <button
                    type="button"
                    className="header-nav-link-btn"
                    onClick={handleLogout}
                  >
                    Déconnexion
                  </button>
                </>
              ) : (
                <>
                  <Link to="/login">Connexion</Link>
                  <Link to="/register">Créer un compte</Link>
                </>
              )}
            </>
          )}
        </div>
      </div>
      {!isLanding && (
        <p className="muted" style={{ margin: 0 }}>
        </p>
      )}
    </header>
  );
}

/** Page d'accueil / landing : design Calisthenics AI (hero + features + démo). */
function LandingPage() {
  const { user, loading } = useAuth();
  if (loading) return <p className="muted">Chargement...</p>;
  if (user) {
    return (
      <div className="card home-welcome">
        <h2 className="home-welcome-title">Bienvenue</h2>
        <p className="muted home-welcome-desc">
          Vous êtes connecté. Accédez à votre tableau de bord ou lancez une analyse.
        </p>
        <div className="buttons">
          <Link to="/" className="btn btn-primary">Tableau de bord</Link>
          <Link to="/analyze" className="btn">Analyser une figure</Link>
        </div>
      </div>
    );
  }
  return <Landing />;
}

function HomePage() {
  const { user, loading } = useAuth();
  if (loading) return <p className="muted">Chargement...</p>;
  if (user) return <Dashboard />;
  return <LandingPage />;
}

function AnalyzePage() {
  const { user } = useAuth();
  const userId = user?.id ?? "demo";
  return (
    <PoseSandbox userId={userId} />
  );
}

export default function App() {
  return (
    <div className="page">
      <Header />
      <main className="content">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/accueil" element={<LandingPage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/analyze" element={<AnalyzePage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}
