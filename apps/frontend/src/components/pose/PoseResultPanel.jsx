import React from "react";
import { round4 } from "../../lib/poseSandboxUtils.js";

/** Afficher Confidence, analysisId, s3Key*, Scores debug (debug). */
const SHOW_RESULT_DEBUG = false;

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
            <div>
              Figure détectée: <span className="mono">{classify.pose}</span>
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

          {Array.isArray(classify.warnings) && classify.warnings.length > 0 ? (
            <ul className="list">
              {classify.warnings.map((w, i) => (
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
                <option value="">Modifier la figure détectée</option>
                {supportedPoses.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </label>

            <button className="btn" onClick={confirmLabel} disabled={!userLabel || confirmStatus === "confirming"}>
              {confirmStatus === "confirming" ? "Confirmation..." : "Confirmer la figure et lancer l'analyse technique"}
            </button>

            {confirmError ? <p className="error">Confirm erreur: {confirmError}</p> : null}
            {confirmStatus === "done" ? (
              <>
                {techniqueScore ? (
                  <details>
                    <summary className="muted">Résultat d'analyse</summary>
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

