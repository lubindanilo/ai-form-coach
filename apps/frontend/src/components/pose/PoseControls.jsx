import React from "react";

/** Afficher la ligne Status / Active model / File / Size / Flow (debug). */
const SHOW_STATUS_META = false;

export default function PoseControls({
  status,
  flowStatus,
  imageInfo,
  activeModel,
  fileDisabled,
  onClear,
}) {
  return (
    <div className="controls">
      <div className="buttons" style={{ gap: 10, display: "flex", flexWrap: "wrap" }}>
        <button className="btn" onClick={onClear} disabled={fileDisabled}>
          Réinitialiser
        </button>
      </div>

      {SHOW_STATUS_META ? (
        <div className="meta muted" style={{ marginTop: 8, display: "flex", gap: 14, flexWrap: "wrap" }}>
          <span>Status: {status}</span>
          <span>Active model: {activeModel}</span>
          <span>File: {imageInfo.name || "-"}</span>
          <span>Size: {imageInfo.w && imageInfo.h ? `${imageInfo.w}×${imageInfo.h}` : "-"}</span>
          <span>Flow: {flowStatus}</span>
        </div>
      ) : null}
    </div>
  );
}

