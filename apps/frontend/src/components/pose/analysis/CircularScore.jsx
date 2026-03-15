import React from "react";
import { getScoreColor, getScoreColorLight, getScoreLabel, getTrackColor, normalizeScore } from "./scoreTheme.js";

/**
 * Jauge circulaire de score (0–max).
 * Présentation uniquement : valeur, max, couleurs et libellé dérivés du thème.
 * Le score est normalisé (0–1 → 0–100, chaînes "80/100", etc.).
 */
export default function CircularScore({ value, max = 100, size = 160, strokeWidth = 10 }) {
  const overallScore = normalizeScore(value);
  const pct = max > 0 ? overallScore / max : 0;
  const color = getScoreColor(overallScore);
  const colorLight = getScoreColorLight(overallScore);
  const trackColor = getTrackColor();
  const label = getScoreLabel(overallScore);

  // DEBUG provisoire : à retirer une fois le bon format de score confirmé
  console.log("CircularScore — score brut =", value, "type =", typeof value, "Number(value) =", Number(value), "overallScore (normalisé 0–100) =", overallScore, "label =", label, "color =", color);

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - pct * circumference;

  return (
    <div className="analysis-circular-score" style={{ width: size, height: size, position: "relative" }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }} aria-hidden="true">
        <defs>
          <linearGradient id="circular-score-gradient" x1="0%" y1="0%" x2="1" y2="1">
            <stop offset="0%" stopColor={color} />
            <stop offset="100%" stopColor={colorLight} />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={trackColor}
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="url(#circular-score-gradient)"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.5s ease-out" }}
        />
      </svg>
      <div
        className="analysis-circular-score-inner"
        style={{
          position: "absolute",
          inset: strokeWidth,
          borderRadius: "50%",
          background: "#1a1a1c",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          pointerEvents: "none",
        }}
      >
        <span style={{ fontSize: "2rem", fontWeight: 700, lineHeight: 1, color: "#f2f2f2" }}>
          {Math.round(overallScore)}
        </span>
        <span style={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.7)" }}>/100</span>
        <span style={{ fontSize: "0.9rem", fontWeight: 500, color: "rgba(255,255,255,0.9)", marginTop: 2 }}>
          {label}
        </span>
      </div>
    </div>
  );
}
