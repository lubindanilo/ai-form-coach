import React from "react";
import PoseSandbox from "./components/PoseSandbox.jsx";

export default function App() {
  return (
    <div className="page">
      <header className="header">
        <h1>Street Workout AI</h1>
        <p className="muted">
          Téléchargez une photo pour analyser votre figure et recevoir des conseils pour l'améliorer.
        </p>
      </header>

      <main className="content">
        <PoseSandbox />
      </main>
    </div>
  );
}