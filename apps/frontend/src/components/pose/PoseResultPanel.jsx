import React from "react";
import { round4 } from "../../lib/poseSandboxUtils.js";
import AnalysisDashboard from "./analysis/AnalysisDashboard.jsx";

/** Afficher Confidence, analysisId, s3Key*, Scores debug (debug). */
const SHOW_RESULT_DEBUG = false;

/** Message de warning qu'on ne souhaite pas afficher (angle caméra / profil). */
const HIDDEN_WARNING_CAMERA_ANGLE =
  "Angle caméra: essaie plutôt un profil net (de côté). Pour Planche/L-Sit/Levers/Elbow lever/Human flag, le profil est beaucoup plus fiable.";

export default function PoseResultPanel({
  classify,
  flowError,
  userLabel,
  setUserLabel,
  supportedPoses,
  confirmLabel,
  confirmStatus,
  confirmError,
  techniqueScore,
}) {
  return (
    <>
      {flowError ? <p className="error">Flow erreur: {flowError}</p> : null}

      {!classify ? null : (
        <div style={{ display: "grid", gap: 10 }}>
          <div className="muted">
            <div
              style={{
                fontSize: "1.5rem",
                fontFamily: "'Segoe UI', system-ui, sans-serif",
                fontWeight: 500,
              }}
            >
              Figure détectée: <span style={{ fontWeight: 600 }}>{classify.pose}</span>
            </div>
            {SHOW_RESULT_DEBUG ? (
              <>
                <div>
                  Confidence: <span className="mono">{round4(classify.confidence)}</span>
                </div>
                <div>
                  analysisId: <span className="mono">{classify.analysisId}</span>
                </div>
                <div>
                  s3KeyImage: <span className="mono">{classify.s3KeyImage}</span>
                </div>
                <div>
                  s3KeyResult: <span className="mono">{classify.s3KeyResult}</span>
                </div>
              </>
            ) : null}
          </div>

          {Array.isArray(classify.warnings) &&
          classify.warnings.filter((w) => w !== HIDDEN_WARNING_CAMERA_ANGLE).length > 0 ? (
            <ul className="list">
              {classify.warnings
                .filter((w) => w !== HIDDEN_WARNING_CAMERA_ANGLE)
                .map((w, i) => (
                  <li key={`${w}-${i}`} className="row" style={{ gridTemplateColumns: "1fr" }}>
                    <span className="mono">{w}</span>
                  </li>
                ))}
            </ul>
          ) : null}

          {SHOW_RESULT_DEBUG && classify.scores ? (
            <details>
              <summary className="muted">Scores debug</summary>
              <pre className="mono" style={{ whiteSpace: "pre-wrap", margin: 0, marginTop: 8 }}>
                {JSON.stringify(classify.scores, null, 2)}
              </pre>
            </details>
          ) : null}

          <div style={{ display: "grid", gap: 8 }}>
            <label className="muted" style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <select
                value={userLabel}
                onChange={(e) => setUserLabel(e.target.value)}
                disabled={confirmStatus === "confirming"}
                style={{
                  padding: "8px 10px",
                  borderRadius: 10,
                  border: "1px solid #2a2a2e",
                  background: "#0f0f11",
                  color: "#f2f2f2",
                }}
              >
                <option value="">Modifier</option>
                {supportedPoses.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </label>

            <button
              className="btn"
              onClick={confirmLabel}
              disabled={!userLabel || confirmStatus === "confirming"}
              style={{
                fontSize: "1rem",
                fontFamily: "'Segoe UI', system-ui, sans-serif",
                fontWeight: 600,
              }}
            >
              {confirmStatus === "confirming" ? "Confirmation..." : "Confirmer la figure et lancer l'analyse technique"}
            </button>

            {confirmError ? <p className="error">Confirm erreur: {confirmError}</p> : null}
            {confirmStatus === "done" ? (
              <>
                {techniqueScore?.scores ? (
                  <div style={{ marginTop: 8 }}>
                    <p className="muted" style={{ marginBottom: 8 }}>Résultat d'analyse</p>
                    <AnalysisDashboard scores={techniqueScore.scores} />
                    {Array.isArray(techniqueScore.improvements) && techniqueScore.improvements.length > 0 ? (
                      <div style={{ marginTop: 12 }}>
                        <p className="muted" style={{ marginBottom: 6, fontSize: "0.95rem" }}>
                          Points d'amélioration
                        </p>
                        <ol
                          className="list"
                          style={{
                            margin: 0,
                            paddingLeft: 20,
                            display: "flex",
                            flexDirection: "column",
                            gap: 6,
                          }}
                        >
                          {techniqueScore.improvements.map((item, i) => (
                            <li key={`${item.metricKey}-${i}`} style={{ color: "#e2e2e2" }}>
                              {item.message}
                            </li>
                          ))}
                        </ol>
                      </div>
                    ) : null}
                  </div>
                ) : null}
                {SHOW_RESULT_DEBUG && techniqueScore ? (
                  <details style={{ marginTop: 12 }}>
                    <summary className="muted">Résultat brut (debug)</summary>
                    <pre className="mono" style={{ whiteSpace: "pre-wrap", margin: 0, marginTop: 8 }}>
                      {JSON.stringify(techniqueScore, null, 2)}
                    </pre>
                  </details>
                ) : null}
              </>
            ) : null}
          </div>
        </div>
      )}
    </>
  );
}

