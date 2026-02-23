import React, { useEffect, useMemo, useRef, useState } from "react";
import { DrawingUtils, PoseLandmarker } from "@mediapipe/tasks-vision";
import { extractPoseSeriesFromVideo } from "../lib/video/extractPoseSeriesFromVideo.js";

export default function VideoUploadAnalyzer({
  getLandmarker,          // async () => landmarker
  onSeriesReady,          // (series) => void
  onError,                // (message) => void
  defaultFps = 15,
}) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const drawingRef = useRef(null);

  const cancelRef = useRef(false);

  const [file, setFile] = useState(null);
  const [videoUrl, setVideoUrl] = useState("");
  const [status, setStatus] = useState("idle"); // idle | ready | extracting | done | error
  const [progress, setProgress] = useState(0);
  const [fps, setFps] = useState(defaultFps);

  // preview d'une frame (dernier résultat)
  const [lastPoseDetected, setLastPoseDetected] = useState(false);

  useEffect(() => {
    if (!file) return;

    const url = URL.createObjectURL(file);
    setVideoUrl(url);
    setStatus("ready");
    setProgress(0);
    setLastPoseDetected(false);

    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    // init drawing ctx
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    drawingRef.current = new DrawingUtils(ctx);
  }, []);

  async function analyze() {
    try {
      cancelRef.current = false;
      setStatus("extracting");
      setProgress(0);
      setLastPoseDetected(false);

      const video = videoRef.current;
      const canvas = canvasRef.current;
      const drawing = drawingRef.current;

      if (!video || !canvas || !drawing) throw new Error("video/canvas non prêts");

      // ajuste la taille canvas au rendu vidéo (après metadata)
      await new Promise((resolve, reject) => {
        if (video.readyState >= 1) return resolve();
        const onLoaded = () => {
          cleanup();
          resolve();
        };
        const onError = () => {
          cleanup();
          reject(new Error("Erreur chargement vidéo"));
        };
        const cleanup = () => {
          video.removeEventListener("loadedmetadata", onLoaded);
          video.removeEventListener("error", onError);
        };
        video.addEventListener("loadedmetadata", onLoaded);
        video.addEventListener("error", onError);
      });

      canvas.width = video.videoWidth || 1280;
      canvas.height = video.videoHeight || 720;

      const landmarker = await getLandmarker();

      const series = await extractPoseSeriesFromVideo({
        videoEl: video,
        landmarker,
        fps,
        shouldCancel: () => cancelRef.current,
        onProgress: (p) => {
          setProgress(p);
        },
      });

      // Dessine un overlay sur la dernière frame (si dispo)
      const last = series.at(-1);
      const pose0 = last?.landmarks ?? null;

      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (pose0) {
        setLastPoseDetected(true);
        drawing.drawLandmarks(pose0, { radius: 2 });
        drawing.drawConnectors(pose0, PoseLandmarker.POSE_CONNECTIONS);
      }

      setStatus(cancelRef.current ? "ready" : "done");
      onSeriesReady?.(series);
    } catch (e) {
      const msg = e?.message ?? String(e);
      setStatus("error");
      onError?.(msg);
    }
  }

  function cancel() {
    cancelRef.current = true;
  }

  return (
    <section className="card">
      <div className="controls">
        <div className="buttons" style={{ gap: 10, display: "flex", flexWrap: "wrap" }}>
          <input
            type="file"
            accept="video/*"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            disabled={status === "extracting"}
          />

          <label className="muted" style={{ display: "flex", gap: 8, alignItems: "center" }}>
            FPS échantillonnage:
            <input
              type="number"
              min={5}
              max={60}
              value={fps}
              onChange={(e) => setFps(Number(e.target.value) || defaultFps)}
              disabled={status === "extracting"}
              style={{ width: 80 }}
            />
          </label>

          <button className="btn" onClick={analyze} disabled={!videoUrl || status === "extracting"}>
            {status === "extracting" ? "Extraction..." : "Extraire landmarks"}
          </button>

          <button className="btn" onClick={cancel} disabled={status !== "extracting"}>
            Cancel
          </button>

          <span className="muted">
            Progress: {Math.round(progress * 100)}%
          </span>
          {status === "done" ? (
            <span className="muted">Dernière frame: {lastPoseDetected ? "pose détectée ✅" : "aucune pose ❌"}</span>
          ) : null}
        </div>
      </div>

      <div className="stage">
        <div className="videoWrap">
          <video
            ref={videoRef}
            className="video"
            src={videoUrl || undefined}
            controls
            playsInline
          />
          <canvas ref={canvasRef} className="canvas" />
        </div>

        <div className="panel">
          <p className="muted">
            Le fichier vidéo reste côté navigateur. On extrait uniquement la série temporelle de landmarks.
          </p>
        </div>
      </div>
    </section>
  );
}