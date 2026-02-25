import React from "react";

export default function PoseControls({
  status,
  flowStatus,
  imageUrl,
  imageInfo,
  activeModel,
  modelMode,
  setModelMode,
  resetLandmarker,
  analyzeCurrentImage,
  canAnalyze,
  fileDisabled,
  onPickFile,
  onClear,
  userId,
  setUserId,
  runS3AndClassify,
  canRunFlow,
  hasPoseLandmarks,
}) {
  return (
    <div className="controls">
      <div className="buttons" style={{ gap: 10, display: "flex", flexWrap: "wrap" }}>
        <input type="file" accept="image/*" onChange={onPickFile} disabled={fileDisabled} />

        <label className="muted" style={{ display: "flex", gap: 8, alignItems: "center" }}>
          Model mode:
          <select
            value={modelMode}
            onChange={(e) => {
              setModelMode(e.target.value);
              resetLandmarker();
              if (imageUrl) setTimeout(() => analyzeCurrentImage(), 0);
            }}
            disabled={fileDisabled}
          >
            <option value="auto">auto (full → lite)</option>
            <option value="full">full only</option>
            <option value="lite">lite only</option>
          </select>
        </label>

        <button className="btn" onClick={analyzeCurrentImage} disabled={!canAnalyze}>
          {status === "loading" ? "Analyse..." : "Analyser la photo"}
        </button>

        <label className="muted" style={{ display: "flex", gap: 8, alignItems: "center" }}>
          userId:
          <input
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            disabled={fileDisabled}
            style={{
              padding: "8px 10px",
              borderRadius: 10,
              border: "1px solid #2a2a2e",
              background: "#0f0f11",
              color: "#f2f2f2",
              minWidth: 160,
            }}
          />
        </label>

        <button className="btn" onClick={runS3AndClassify} disabled={!canRunFlow || !hasPoseLandmarks}>
          {flowStatus === "presign"
            ? "Presign..."
            : flowStatus === "uploading"
              ? "Upload S3..."
              : flowStatus === "classifying"
                ? "Classify..."
                : "S3 + Classify"}
        </button>

        <button className="btn" onClick={onClear} disabled={fileDisabled}>
          Clear
        </button>
      </div>

      <div className="meta muted" style={{ marginTop: 8, display: "flex", gap: 14, flexWrap: "wrap" }}>
        <span>Status: {status}</span>
        <span>Active model: {activeModel}</span>
        <span>File: {imageInfo.name || "-"}</span>
        <span>Size: {imageInfo.w && imageInfo.h ? `${imageInfo.w}×${imageInfo.h}` : "-"}</span>
        <span>Flow: {flowStatus}</span>
      </div>

      <p className="muted" style={{ marginTop: 8 }}>
        ✅ Mode PHOTO uniquement : pas de webcam, pas de vidéo.
      </p>
    </div>
  );
}

