import React from "react";
import PoseSandbox from "./components/PoseSandbox.jsx";

export default function App() {
  return (
    <div className="page">
      <header className="header">
        <h1>MediaPipe Pose — Test local</h1>
        <p className="muted">
          Webcam → PoseLandmarker (browser) → overlay squelette + aperçu des landmarks.
        </p>
      </header>

      <main className="content">
        <PoseSandbox />
      </main>

      <footer className="footer muted">
        <p>
          Note: MediaPipe télécharge WASM + modèle au premier run (petit délai initial).
        </p>
      </footer>
    </div>
  );
}