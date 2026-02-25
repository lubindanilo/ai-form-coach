import React from "react";
import { round4 } from "../../lib/poseSandboxUtils.js";

export default function PoseResultPanel({
  classify,
  flowStatus,
  flowError,
  userLabel,
  setUserLabel,
  supportedPoses,
  confirmLabel,
  confirmStatus,
  confirmError,
  datasetSampleId,
}) {
  return (
    <>
      <h3>Résultat scoring (API)</h3>

      {flowError ? <p className="error">Flow erreur: {flowError}</p> : null}

      {!classify ? (
        <p className="muted">
          Clique sur <span className="mono">S3 + Classify</span> pour uploader l’image sur S3 et appeler le scoring.
        </p>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          <div className="muted">
            <div>
              Pose: <span className="mono">{classify.pose}</span>
            </div>
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
          </div>

          {Array.isArray(classify.warnings) && classify.warnings.length > 0 ? (
            <div>
              <div className="muted" style={{ marginBottom: 6 }}>
                Warnings:
              </div>
              <ul className="list">
                {classify.warnings.map((w, i) => (
                  <li key={`${w}-${i}`} className="row" style={{ gridTemplateColumns: "1fr" }}>
                    <span className="mono">{w}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="muted">Warnings: aucune</p>
          )}

          {classify.scores ? (
            <details>
              <summary className="muted">Scores debug</summary>
              <pre className="mono" style={{ whiteSpace: "pre-wrap", margin: 0, marginTop: 8 }}>
                {JSON.stringify(classify.scores, null, 2)}
              </pre>
            </details>
          ) : null}

          <div style={{ display: "grid", gap: 8 }}>
            <label className="muted" style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              userLabel:
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
                <option value="">-- choisir --</option>
                {supportedPoses.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </label>

            <button className="btn" onClick={confirmLabel} disabled={!userLabel || confirmStatus === "confirming"}>
              {confirmStatus === "confirming" ? "Confirmation..." : "✅ Confirmer (log dataset)"}
            </button>

            {confirmError ? <p className="error">Confirm erreur: {confirmError}</p> : null}
            {confirmStatus === "done" ? (
              <p className="muted">
                Confirm OK. datasetSampleId: <span className="mono">{datasetSampleId || "-"}</span>
              </p>
            ) : null}
          </div>
        </div>
      )}

      <p className="muted" style={{ marginTop: 8 }}>
        Flow status: <span className="mono">{flowStatus}</span>
      </p>
    </>
  );
}

