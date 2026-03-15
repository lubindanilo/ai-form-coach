import React from "react";
import { getScoreColor, getTrackColor, normalizeScore } from "./scoreTheme.js";

/**
 * Une métrique sous forme de barre horizontale + score.
 * Couleur selon le score (même échelle que le global), pas d'appréciation.
 * Le score est normalisé (0–1 → 0–100, chaînes, etc.).
 */
export default function MetricBar({ label, value, max = 100 }) {
  const score = normalizeScore(value);
  const pct = max > 0 ? (score / max) * 100 : 0;
  const color = getScoreColor(score);
  const trackColor = getTrackColor();

  return (
    <div className="analysis-metric-bar" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <span style={{ fontSize: "0.95rem", color: "#f2f2f2", fontWeight: 500 }}>{label}</span>
        <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.9rem", color: "#f2f2f2" }}>
          <span className="mono">{Math.round(score)}/100</span>
        </span>
      </div>
      <div
        role="progressbar"
        aria-valuenow={score}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-label={`${label}: ${Math.round(score)}/100`}
        style={{
          height: 8,
          borderRadius: 4,
          background: trackColor,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${pct}%`,
            background: color,
            borderRadius: 4,
            transition: "width 0.4s ease-out",
          }}
        />
      </div>
    </div>
  );
}
