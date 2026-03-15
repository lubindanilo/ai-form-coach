import React from "react";
import { Link } from "react-router-dom";
import LandingDemoCard from "../components/landing/LandingDemoCard.jsx";

export default function Landing() {
  return (
    <div className="landing">
      <section className="landing-hero">
        <div className="landing-hero__left">
          <div className="landing-hero__text">
            <h1 className="landing-hero__title">
            Découvres exactement quoi corriger sur tes figures de calisthénie et progresse plus vite
            </h1>
            <p className="landing-hero__desc">
            Importe une photo, obtiens un score technique clair et 3 corrections immédiatement applicables.
            </p>
            <div className="landing-hero__ctas">
              <Link to="/analyze" className="landing-cta landing-cta--primary">
                Analyser ma figure
              </Link>
              <Link to="/register" className="landing-cta landing-cta--secondary">
                Créer un compte
              </Link>
            </div>
          </div>
          <section className="landing-features">
        <div className="landing-feature-card">
          <div className="landing-feature-card__icon landing-feature-card__icon--detection" aria-hidden>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 4V2" /><path d="M15 16v-2" /><path d="M8 9h2" /><path d="M20 9h2" />
              <path d="M17.8 11.8L19 13" /><path d="M15 9h0" /><path d="M17.8 6.2L19 5" />
              <path d="m3 21 9-9" /><path d="m12 12 6 6" /><path d="m3 12 3-3 3-3" />
            </svg>
          </div>
          <h3 className="landing-feature-card__title">Diagnostic immédiat</h3>
          <p className="landing-feature-card__desc">
          Upload ta photo et obtiens instantanément une analyse claire de ta figure, comme avec un coach personnel.
          </p>
        </div>
        <div className="landing-feature-card">
          <div className="landing-feature-card__icon landing-feature-card__icon--score" aria-hidden>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="9" strokeOpacity="0.35" />
              <circle cx="12" cy="12" r="9" strokeDasharray="45 32" strokeDashoffset="11" transform="rotate(-90 12 12)" />
            </svg>
          </div>
          <h3 className="landing-feature-card__title">Comprends exactement ce qui te bloque</h3>
          <p className="landing-feature-card__desc">
          Un score global et des métriques détaillées pour voir en un coup d’œil ce qui freine ta posture.
          </p>
        </div>
        <div className="landing-feature-card">
          <div className="landing-feature-card__icon landing-feature-card__icon--progress" aria-hidden>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 18 L8 12 L12 15 L21 6" />
              <path d="M21 6v4h-4" />
            </svg>
          </div>
          <h3 className="landing-feature-card__title">Mesure ta progression dans le temps
          </h3>
          <p className="landing-feature-card__desc">
          Compare tes analyses, vois ce qui s’améliore réellement et valide objectivement tes progrès sur chaque figure.
          </p>
        </div>
          </section>
        </div>
        <div className="landing-hero__demo">
          <LandingDemoCard />
        </div>
      </section>
    </div>
  );
}
