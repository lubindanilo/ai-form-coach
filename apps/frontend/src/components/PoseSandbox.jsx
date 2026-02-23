import React, { useEffect, useMemo, useRef, useState } from "react";
import { DrawingUtils, FilesetResolver, PoseLandmarker } from "@mediapipe/tasks-vision";

const KEYPOINTS = [
  { name: "LEFT_SHOULDER", idx: 11 },
  { name: "RIGHT_SHOULDER", idx: 12 },
  { name: "LEFT_HIP", idx: 23 },
  { name: "RIGHT_HIP", idx: 24 },
  { name: "LEFT_KNEE", idx: 25 },
  { name: "RIGHT_KNEE", idx: 26 },
  { name: "LEFT_ANKLE", idx: 27 },
  { name: "RIGHT_ANKLE", idx: 28 },
];

function round4(v) {
  if (typeof v !== "number" || Number.isNaN(v)) return 0;
  return Math.round(v * 10000) / 10000;
}

function confFrom(lm) {
  const v = typeof lm.visibility === "number" ? lm.visibility : null;
  const p = typeof lm.presence === "number" ? lm.presence : null;
  if (typeof v === "number" && typeof p === "number") return Math.min(v, p);
  if (typeof v === "number") return v;
  if (typeof p === "number") return p;
  return 0;
}

export default function PoseSandbox() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  const landmarkerRef = useRef(null);
  const drawingUtilsRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef = useRef(null);

  const [status, setStatus] = useState("idle"); // idle | loading | running | stopped | error
  const [error, setError] = useState("");
  const [fps, setFps] = useState(0);
  const [preview, setPreview] = useState([]);

  const lastFpsTsRef = useRef(performance.now());
  const fpsFramesRef = useRef(0);
  const frameCounterRef = useRef(0);

  const modelPath = useMemo(() => "/models/pose_landmarker_lite.task", []);

  async function initLandmarkerIfNeeded() {
    if (landmarkerRef.current) return landmarkerRef.current;

    setStatus("loading");
    setError("");

    const vision = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
    );

    const landmarker = await PoseLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: modelPath,
        // delegate: "GPU", // optionnel; si souci perf/compat, laisse commenté
      },
      runningMode: "VIDEO",
      numPoses: 1,
      minPoseDetectionConfidence: 0.5,
      minPosePresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
      outputSegmentationMasks: false,
    });

    landmarkerRef.current = landmarker;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    drawingUtilsRef.current = new DrawingUtils(ctx);

    return landmarker;
  }

  function updateFps() {
    fpsFramesRef.current += 1;
    const now = performance.now();
    const dt = now - lastFpsTsRef.current;
    if (dt >= 1000) {
      const computed = Math.round((fpsFramesRef.current * 1000) / dt);
      setFps(computed);
      fpsFramesRef.current = 0;
      lastFpsTsRef.current = now;
    }
  }

  async function startWebcam() {
    try {
      await stopWebcam();

      const video = videoRef.current;
      const canvas = canvasRef.current;

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720 },
        audio: false,
      });

      streamRef.current = stream;
      video.srcObject = stream;
      video.playsInline = true;

      await video.play();

      canvas.width = video.videoWidth || 1280;
      canvas.height = video.videoHeight || 720;

      await initLandmarkerIfNeeded();

      // reset UI counters
      lastFpsTsRef.current = performance.now();
      fpsFramesRef.current = 0;
      setFps(0);
      setPreview([]);

      setStatus("running");
      loop();
    } catch (e) {
      setStatus("error");
      setError(e?.message ?? String(e));
    }
  }

  async function stopWebcam() {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) track.stop();
      streamRef.current = null;
    }

    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    const video = videoRef.current;
    if (video) {
      video.pause();
      video.srcObject = null;
    }

    setPreview([]);
    setStatus((s) => (s === "running" || s === "loading" ? "stopped" : s));
  }

  async function safeDetectForVideo(landmarker, video, tsMs) {
    // Compat: certaines versions ont un callback (3 args), d’autres retournent direct
    if (landmarker.detectForVideo.length >= 3) {
      return await new Promise((resolve) => {
        landmarker.detectForVideo(video, tsMs, (result) => resolve(result));
      });
    }
    return landmarker.detectForVideo(video, tsMs);
  }

  async function loop() {
    const landmarker = landmarkerRef.current;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const drawingUtils = drawingUtilsRef.current;

    if (!landmarker || !video || video.readyState < 2) {
      rafRef.current = requestAnimationFrame(loop);
      return;
    }

    const tsMs = performance.now();
    const result = await safeDetectForVideo(landmarker, video, tsMs);

    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const pose0 = result?.landmarks?.[0] ?? null;
    if (pose0) {
      drawingUtils.drawLandmarks(pose0, { radius: 2 });
      drawingUtils.drawConnectors(pose0, PoseLandmarker.POSE_CONNECTIONS);
    }

    ctx.restore();

    // Update preview & logs pas à chaque frame (évite de lag React)
    frameCounterRef.current += 1;
    if (frameCounterRef.current % 6 === 0 && pose0 && pose0.length >= 33) {
      const rows = KEYPOINTS.map(({ name, idx }) => {
        const lm = pose0[idx] ?? {};
        return {
          name,
          idx,
          x: round4(lm.x ?? 0),
          y: round4(lm.y ?? 0),
          z: round4(lm.z ?? 0),
          c: round4(confFrom(lm)),
        };
      });
      setPreview(rows);

      // Exemple brut pour comprendre la structure
      // eslint-disable-next-line no-console
      console.log("PoseLandmarker result sample:", {
        landmarks0: result?.landmarks?.[0],
        worldLandmarks0: result?.worldLandmarks?.[0],
      });
    }

    updateFps();
    rafRef.current = requestAnimationFrame(loop);
  }

  useEffect(() => {
    return () => {
      stopWebcam();
      try {
        landmarkerRef.current?.close?.();
      } catch {
        // ignore
      }
      landmarkerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const running = status === "running" || status === "loading";

  return (
    <section className="card">
      <div className="controls">
        <div className="buttons">
          <button className="btn" onClick={startWebcam} disabled={running}>
            {status === "loading" ? "Loading..." : "Start webcam"}
          </button>
          <button className="btn" onClick={stopWebcam} disabled={!running}>
            Stop
          </button>
        </div>

        <div className="meta muted">
          <span>Status: {status}</span>
          <span>FPS: {fps}</span>
          <span>Model: {modelPath}</span>
        </div>

        {error ? <p className="error">Erreur: {error}</p> : null}
      </div>

      <div className="stage">
        <div className="videoWrap">
          <video ref={videoRef} className="mirror video" />
          <canvas ref={canvasRef} className="mirror canvas" />
        </div>

        <div className="panel">
          <h3>Landmarks (extrait)</h3>
          <p className="muted">
            x,y ∈ [0..1]. z = profondeur. c ≈ confiance (visibility/presence).
          </p>

          {preview.length === 0 ? (
            <p className="muted">Clique “Start webcam” puis regarde DevTools Console.</p>
          ) : (
            <ul className="list">
              {preview.map((r) => (
                <li key={r.name} className="row">
                  <span className="mono">{r.name}</span>
                  <span className="mono">#{r.idx}</span>
                  <span className="mono">x={r.x}</span>
                  <span className="mono">y={r.y}</span>
                  <span className="mono">z={r.z}</span>
                  <span className="mono">c={r.c}</span>
                </li>
              ))}
            </ul>
          )}

          <p className="muted" style={{ marginTop: 10 }}>
            Astuce: DevTools → Console → tu verras <span className="mono">result.landmarks[0]</span> (33 points).
          </p>
        </div>
      </div>
    </section>
  );
}