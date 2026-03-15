import React from "react";
import CircularScore from "../pose/analysis/CircularScore.jsx";
import MetricBar from "../pose/analysis/MetricBar.jsx";
import { DIMENSION_METRICS } from "../pose/analysis/metricConfig.js";

/** Données mock pour la démo landing (L-Sit, score 80). */
const MOCK_SCORES = {
  global: 86,
  body_line: 84,
  symmetry: 79,
  lockout_extension: 96,
};

const MOCK_IMPROVEMENTS = [
  "Remonte légèrement le bassin — Gagne quelques centimètres pour obtenir une horizontale vraiment parfaite.",
  "Verrouille davantage le bras du haut — Tends complètement le coude pour renforcer la ligne et rendre la position plus propre.",
  "Serre davantage les jambes — Garde-les complètement collées pour créer une ligne plus nette et plus élégante.",
];

/**
 * Carte démo du résultat d'analyse pour la landing (hero).
 * Affiche un faux résultat L-Sit avec score, métriques et conseils.
 */
export default function LandingDemoCard() {
  return (
    <div className="landing-demo-card">
      <div className="landing-demo-card__image-wrap">
        <div className="landing-demo-card__image-placeholder">
          <img
            src="/landing.png"
            alt="Exemple d'analyse de posture calisthénie"
            className="landing-demo-card__image"
          />
        </div>
      </div>

      <p className="landing-demo-card__figure">
        Figure détectée: <strong>Human Flag</strong>
      </p>

      <div className="landing-demo-card__analysis">
        <CircularScore value={MOCK_SCORES.global} size={120} strokeWidth={9} />
        <div className="landing-demo-card__metrics">
          {DIMENSION_METRICS.map(({ key, label }) => (
            <MetricBar key={key} label={label} value={MOCK_SCORES[key]} />
          ))}
        </div>
      </div>

      <div className="landing-demo-card__feedback">
        <p className="landing-demo-card__feedback-title">Points d'amélioration</p>
        <ul className="landing-demo-card__list">
          {MOCK_IMPROVEMENTS.map((text, i) => (
            <li key={i}>{text}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
