import React, { useEffect, useMemo, useRef, useState } from "react";
import { DrawingUtils, PoseLandmarker } from "@mediapipe/tasks-vision";
import {
  createPoseLandmarkerDirect,
  createPoseLandmarkerWithFallback,
} from "../lib/poseLandmarkerFactory.js";
import { augmentPose, POSE_IDX } from "../lib/poseAugment.js";
import VideoUploadAnalyzer from "./VideoUploadAnalyzer.jsx";

const KEYPOINTS = [
  // Core strength joints
  { name: "LEFT_SHOULDER", idx: POSE_IDX.LEFT_SHOULDER },
  { name: "RIGHT_SHOULDER", idx: POSE_IDX.RIGHT_SHOULDER },
  { name: "LEFT_HIP", idx: POSE_IDX.LEFT_HIP },
  { name: "RIGHT_HIP", idx: POSE_IDX.RIGHT_HIP },
  { name: "LEFT_KNEE", idx: POSE_IDX.LEFT_KNEE },
  { name: "RIGHT_KNEE", idx: POSE_IDX.RIGHT_KNEE },
  { name: "LEFT_ANKLE", idx: POSE_IDX.LEFT_ANKLE },
  { name: "RIGHT_ANKLE", idx: POSE_IDX.RIGHT_ANKLE },

  // Foot details (often forgotten)
  { name: "LEFT_HEEL", idx: POSE_IDX.LEFT_HEEL },
  { name: "RIGHT_HEEL", idx: POSE_IDX.RIGHT_HEEL },
  { name: "LEFT_FOOT_INDEX", idx: POSE_IDX.LEFT_FOOT_INDEX },
  { name: "RIGHT_FOOT_INDEX", idx: POSE_IDX.RIGHT_FOOT_INDEX },
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

function dist2D(a, b) {
  const dx = (a?.x ?? 0) - (b?.x ?? 0);
  const dy = (a?.y ?? 0) - (b?.y ?? 0);
  return Math.sqrt(dx * dx + dy * dy);
}

export default function PoseSandbox() {
  // Webcam elements
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  // Landmarker + draw
  const landmarkerRef = useRef(null);
  const drawingUtilsRef = useRef(null);

  // Webcam runtime
  const streamRef = useRef(null);
  const rafRef = useRef(null);

  // UI state
  const [status, setStatus] = useState("idle"); // idle | loading | running | stopped | error
  const [error, setError] = useState("");
  const [fps, setFps] = useState(0);

  // Input mode
  const [inputMode, setInputMode] = useState("webcam"); // webcam | upload

  // Model selection
  const [activeModel, setActiveModel] = useState("unknown"); // full | lite | unknown
  const [modelMode, setModelMode] = useState("auto"); // auto | full | lite

  // Webcam previews
  const [preview, setPreview] = useState([]);
  const [derivedPreview, setDerivedPreview] = useState([]);

  // Metrics (webcam only)
  const [metrics, setMetrics] = useState({
    frames: 0,
    missFrames: 0,
    missRatePct: 0,
    avgConf: 0,
    avgJitter: 0,
  });

  const metricsRef = useRef({
    frames: 0,
    missFrames: 0,
    confSum: 0,
    confCount: 0,
    jitterSum: 0,
    jitterCount: 0,
    lastPose: null,
    lastUiUpdate: performance.now(),
  });

  const lastFpsTsRef = useRef(performance.now());
  const fpsFramesRef = useRef(0);
  const frameCounterRef = useRef(0);

  // Upload info
  const [uploadInfo, setUploadInfo] = useState(null); // { frames, fps }

  const modelFullPath = useMemo(() => "/models/pose_landmarker_full.task", []);
  const modelLitePath = useMemo(() => "/models/pose_landmarker_lite.task", []);

  function resetMetrics() {
    metricsRef.current = {
      frames: 0,
      missFrames: 0,
      confSum: 0,
      confCount: 0,
      jitterSum: 0,
      jitterCount: 0,
      lastPose: null,
      lastUiUpdate: performance.now(),
    };
    setMetrics({
      frames: 0,
      missFrames: 0,
      missRatePct: 0,
      avgConf: 0,
      avgJitter: 0,
    });
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

  async function initLandmarkerIfNeeded() {
    if (landmarkerRef.current) return landmarkerRef.current;

    setStatus("loading");
    setError("");

    const overrides = {
      // runningMode est déjà "VIDEO" par défaut dans ta factory,
      // mais on le laisse ici explicitement (webcam + upload utilisent detectForVideo).
      runningMode: "VIDEO",
      numPoses: 1,
      minPoseDetectionConfidence: 0.5,
      minPosePresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
      outputSegmentationMasks: false,
    };

    let landmarker;
    let modelName = "unknown";

    if (modelMode === "full") {
      landmarker = await createPoseLandmarkerDirect(modelFullPath, overrides);
      modelName = "full";
    } else if (modelMode === "lite") {
      landmarker = await createPoseLandmarkerDirect(modelLitePath, overrides);
      modelName = "lite";
    } else {
      const out = await createPoseLandmarkerWithFallback({
        primaryModelPath: modelFullPath,
        fallbackModelPath: modelLitePath,
        primaryName: "full",
        fallbackName: "lite",
        overrides,
      });
      landmarker = out.landmarker;
      modelName = out.activeModel;
    }

    landmarkerRef.current = landmarker;
    setActiveModel(modelName);

    // Init drawing ctx for webcam canvas
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      drawingUtilsRef.current = new DrawingUtils(ctx);
    }

    return landmarker;
  }

  async function safeDetectForVideo(landmarker, video, tsMs) {
    if (landmarker.detectForVideo.length >= 3) {
      return await new Promise((resolve) => {
        landmarker.detectForVideo(video, tsMs, (result) => resolve(result));
      });
    }
    return landmarker.detectForVideo(video, tsMs);
  }

  function updateMetrics(pose0) {
    const m = metricsRef.current;
    m.frames += 1;

    if (!pose0) {
      m.missFrames += 1;
    } else {
      // confidence: moyenne sur 8 points "core"
      for (const kp of KEYPOINTS.slice(0, 8)) {
        const lm = pose0[kp.idx] ?? {};
        m.confSum += confFrom(lm);
        m.confCount += 1;
      }

      // jitter: variation frame-to-frame sur les 8 points core
      if (m.lastPose) {
        for (const kp of KEYPOINTS.slice(0, 8)) {
          const a = pose0[kp.idx];
          const b = m.lastPose[kp.idx];
          if (a && b) {
            m.jitterSum += dist2D(a, b);
            m.jitterCount += 1;
          }
        }
      }
      m.lastPose = pose0;
    }

    const now = performance.now();
    if (now - m.lastUiUpdate >= 1000) {
      const missRatePct = m.frames > 0 ? (100 * m.missFrames) / m.frames : 0;
      const avgConf = m.confCount > 0 ? m.confSum / m.confCount : 0;
      const avgJitter = m.jitterCount > 0 ? m.jitterSum / m.jitterCount : 0;

      setMetrics({
        frames: m.frames,
        missFrames: m.missFrames,
        missRatePct: Math.round(missRatePct * 10) / 10,
        avgConf: round4(avgConf),
        avgJitter: round4(avgJitter),
      });

      m.lastUiUpdate = now;
    }
  }

  function drawExtraPoints(ctx, extraOrder, w, h) {
    // Dessine des petits points pour les virtual landmarks (neutre)
    ctx.save();
    for (const item of extraOrder) {
      const lm = item.lm;
      const x = (lm.x ?? 0) * w;
      const y = (lm.y ?? 0) * h;
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, 2 * Math.PI);
      ctx.stroke();
    }
    ctx.restore();
  }

  async function loop() {
    const landmarker = landmarkerRef.current;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const drawingUtils = drawingUtilsRef.current;

    if (!landmarker || !video || !canvas || !drawingUtils || video.readyState < 2) {
      rafRef.current = requestAnimationFrame(loop);
      return;
    }

    const ctx = canvas.getContext("2d");

    // Webcam: on utilise performance.now() comme timestamp (ok pour VIDEO runningMode)
    const tsMs = performance.now();
    const result = await safeDetectForVideo(landmarker, video, tsMs);

    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const pose0 = result?.landmarks?.[0] ?? null;

    if (pose0) {
      drawingUtils.drawLandmarks(pose0, { radius: 2 });
      drawingUtils.drawConnectors(pose0, PoseLandmarker.POSE_CONNECTIONS);

      const augmented = augmentPose(pose0);
      drawExtraPoints(ctx, augmented.extraOrder, canvas.width, canvas.height);

      // UI preview: 1 update / 6 frames
      frameCounterRef.current += 1;
      if (frameCounterRef.current % 6 === 0) {
        const rows = KEYPOINTS.map(({ name, idx }) => {
          const lm = pose0[idx] ?? {};
          return {
            name,
            x: round4(lm.x ?? 0),
            y: round4(lm.y ?? 0),
            z: round4(lm.z ?? 0),
            c: round4(confFrom(lm)),
          };
        });
        setPreview(rows);

        const drows = augmented.extraOrder.map(({ name, lm }) => ({
          name,
          x: round4(lm.x ?? 0),
          y: round4(lm.y ?? 0),
          z: round4(lm.z ?? 0),
          c: round4(lm.c ?? 0),
        }));
        setDerivedPreview(drows);
      }
    }

    ctx.restore();

    updateMetrics(pose0);
    updateFps();
    rafRef.current = requestAnimationFrame(loop);
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

      resetMetrics();
      await initLandmarkerIfNeeded();

      lastFpsTsRef.current = performance.now();
      fpsFramesRef.current = 0;
      setFps(0);

      setPreview([]);
      setDerivedPreview([]);
      setUploadInfo(null);

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
    setDerivedPreview([]);
    setStatus((s) => (s === "running" || s === "loading" ? "stopped" : s));
  }

  function resetLandmarker() {
    try {
      landmarkerRef.current?.close?.();
    } catch {
      // ignore
    }
    landmarkerRef.current = null;
    setActiveModel("unknown");
  }

  // Cleanup unmount
  useEffect(() => {
    return () => {
      stopWebcam();
      resetLandmarker();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When switching to upload mode: ensure webcam is stopped
  useEffect(() => {
    if (inputMode === "upload") {
      stopWebcam();
      setStatus("idle");
      setFps(0);
      setPreview([]);
      setDerivedPreview([]);
      resetMetrics();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputMode]);

  const runningWebcam = status === "running" || status === "loading";
  const canChangeMode = !runningWebcam;

  return (
    <section className="card">
      <div className="controls">
        <div className="buttons">
          <button
            className="btn"
            onClick={startWebcam}
            disabled={runningWebcam || inputMode !== "webcam"}
            title={inputMode !== "webcam" ? "Passe en mode webcam pour démarrer" : ""}
          >
            {status === "loading" ? "Loading..." : "Start webcam"}
          </button>

          <button className="btn" onClick={stopWebcam} disabled={!runningWebcam}>
            Stop
          </button>

          <label
            className="muted"
            style={{ display: "flex", gap: 8, alignItems: "center", marginLeft: 10 }}
          >
            Input:
            <select
              value={inputMode}
              onChange={(e) => setInputMode(e.target.value)}
              disabled={!canChangeMode}
            >
              <option value="webcam">webcam</option>
              <option value="upload">upload video</option>
            </select>
          </label>

          <label className="muted" style={{ display: "flex", gap: 8, alignItems: "center" }}>
            Model mode:
            <select
              value={modelMode}
              onChange={(e) => {
                setModelMode(e.target.value);
                resetLandmarker();
                resetMetrics();
                setError("");
              }}
              disabled={runningWebcam}
            >
              <option value="auto">auto (full → lite)</option>
              <option value="full">full only</option>
              <option value="lite">lite only</option>
            </select>
          </label>
        </div>

        <div className="meta muted">
          <span>Status: {status}</span>
          <span>FPS: {inputMode === "webcam" ? fps : "-"}</span>
          <span>Active model: {activeModel}</span>
        </div>

        {inputMode === "webcam" ? (
          <div className="meta muted">
            <span>Frames: {metrics.frames}</span>
            <span>
              Miss: {metrics.missFrames} ({metrics.missRatePct}%)
            </span>
            <span>Avg conf: {metrics.avgConf}</span>
            <span>Avg jitter: {metrics.avgJitter}</span>
          </div>
        ) : (
          <div className="meta muted">
            <span>Upload: {uploadInfo ? `${uploadInfo.frames} frames @ ${uploadInfo.fps} fps` : "-"}</span>
          </div>
        )}

        {error ? <p className="error">Erreur: {error}</p> : null}
      </div>

      {inputMode === "webcam" ? (
        <div className="stage">
          <div className="videoWrap">
            <video ref={videoRef} className="mirror video" />
            <canvas ref={canvasRef} className="mirror canvas" />
          </div>

          <div className="panel">
            <h3>Points natifs utiles (extrait)</h3>
            {preview.length === 0 ? (
              <p className="muted">Démarre la webcam.</p>
            ) : (
              <ul className="list">
                {preview.map((r) => (
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

            <h3 style={{ marginTop: 14 }}>Points dérivés (virtual landmarks)</h3>
            {derivedPreview.length === 0 ? (
              <p className="muted">Ils apparaîtront dès qu’une pose est détectée.</p>
            ) : (
              <ul className="list">
                {derivedPreview.map((r) => (
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

            <p className="muted" style={{ marginTop: 10 }}>
              Important: ces points dérivés seront recalculés côté scoring (Python) à partir des 33 natifs pour garder la logique unique.
            </p>
          </div>
        </div>
      ) : (
        <VideoUploadAnalyzer
          defaultFps={15}
          getLandmarker={async () => {
            // utilise le même landmarker / même logique full/lite/auto
            const lm = await initLandmarkerIfNeeded();
            return lm;
          }}
          onError={(msg) => {
            setError(msg);
            setStatus("error");
          }}
          onSeriesReady={(series) => {
            setError("");
            setStatus("stopped");
            setUploadInfo({ frames: series.length, fps: 15 });

            // Exemple: tu peux POST vers /api/analyze ici (MVP)
            // await fetch("/api/analyze", { method:"POST", headers:{ "Content-Type":"application/json" }, body: JSON.stringify({ exercise:"squat", fps:15, series }) })

            // eslint-disable-next-line no-console
            console.log("UPLOAD SERIES READY", { frames: series.length, sample: series.slice(0, 2) });
          }}
        />
      )}
    </section>
  );
}