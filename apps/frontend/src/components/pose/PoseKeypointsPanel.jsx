import React from "react";

export default function PoseKeypointsPanel({ title, emptyText, rows }) {
  return (
    <>
      <h3 style={{ marginTop: 14 }}>{title}</h3>
      {rows.length === 0 ? (
        <p className="muted">{emptyText}</p>
      ) : (
        <ul className="list">
          {rows.map((r) => (
            <li key={r.name} className="row">
              <span className="mono">{r.name}</span>
              <span className="mono">x={r.x}</span>
              <span className="mono">y={r.y}</span>
              <span className="mono">z={r.z}</span>
              <span className="mono">c={r.c}</span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

