import React, { useEffect, useMemo, useRef, useState } from "react";
import { DrawingUtils, PoseLandmarker } from "@mediapipe/tasks-vision";
import {
  createPoseLandmarkerDirect,
  createPoseLandmarkerWithFallback,
} from "../lib/poseLandmarkerFactory.js";
import { augmentPose, POSE_IDX } from "../lib/poseAugment.js";
import PoseControls from "./pose/PoseControls.jsx";
import PoseResultPanel from "./pose/PoseResultPanel.jsx";
import PoseKeypointsPanel from "./pose/PoseKeypointsPanel.jsx";
import {
  confFrom,
  drawExtraPoints,
  drawPose,
  fetchJson,
  loadImageFromUrl,
  mapLandmarksForApi,
  round4,
  safeDetectForImage,
} from "../lib/poseSandboxUtils.js";

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

  // Foot details
  { name: "LEFT_HEEL", idx: POSE_IDX.LEFT_HEEL },
  { name: "RIGHT_HEEL", idx: POSE_IDX.RIGHT_HEEL },
  { name: "LEFT_FOOT_INDEX", idx: POSE_IDX.LEFT_FOOT_INDEX },
  { name: "RIGHT_FOOT_INDEX", idx: POSE_IDX.RIGHT_FOOT_INDEX },
];

export default function PoseSandbox() {
  // Canvas
  const canvasRef = useRef(null);
  const drawingUtilsRef = useRef(null);

  // Landmarker
  const landmarkerRef = useRef(null);

  // UI
  const [status, setStatus] = useState("idle"); // idle | ready | loading | done | error
  const [error, setError] = useState("");

  // File / preview
  const [file, setFile] = useState(null);
  const [imageUrl, setImageUrl] = useState("");
  const [imageInfo, setImageInfo] = useState({ w: 0, h: 0, name: "" });

  // Model selection
  const [activeModel, setActiveModel] = useState("unknown"); // full | lite | unknown
  const [modelMode, setModelMode] = useState("auto"); // auto | full | lite

  // Previews
  const [preview, setPreview] = useState([]);
  const [derivedPreview, setDerivedPreview] = useState([]);
  const [poseLandmarks, setPoseLandmarks] = useState(null); // raw 33 landmarks from MediaPipe (first pose)

  // Backend flow
  const [userId, setUserId] = useState("demo");
  const [flowStatus, setFlowStatus] = useState("idle"); // idle | presign | uploading | classifying | done | error
  const [flowError, setFlowError] = useState("");
  const [presign, setPresign] = useState(null); // {analysisId, s3KeyImage, uploadUrl, expiresIn}
  const [classify, setClassify] = useState(null); // response from /api/pose/classify
  const [confirmStatus, setConfirmStatus] = useState("idle"); // idle | confirming | done | error
  const [confirmError, setConfirmError] = useState("");
  const [userLabel, setUserLabel] = useState("");
  const [datasetSampleId, setDatasetSampleId] = useState(null);

  const modelFullPath = useMemo(() => "/models/pose_landmarker_full.task", []);
  const modelLitePath = useMemo(() => "/models/pose_landmarker_lite.task", []);

  const SUPPORTED_POSES = useMemo(
    () => [
      "full_planche",
      "l_sit",
      "front_lever",
      "human_flag",
      "handstand",
      "elbow_lever",
      "back_lever",
    ],
    []
  );

  // Init drawing ctx
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    drawingUtilsRef.current = new DrawingUtils(ctx);
  }, []);

  // Object URL from uploaded file
  useEffect(() => {
    if (!file) {
      setImageUrl("");
      setImageInfo({ w: 0, h: 0, name: "" });
      setPreview([]);
      setDerivedPreview([]);
      setPoseLandmarks(null);
      setStatus("idle");
      setError("");
      setFlowStatus("idle");
      setFlowError("");
      setPresign(null);
      setClassify(null);
      setConfirmStatus("idle");
      setConfirmError("");
      setUserLabel("");
      setDatasetSampleId(null);
      return;
    }

    const url = URL.createObjectURL(file);
    setImageUrl(url);
    setImageInfo({ w: 0, h: 0, name: file.name || "photo" });
    setStatus("ready");
    setError("");
    setFlowStatus("idle");
    setFlowError("");
    setPresign(null);
    setClassify(null);
    setConfirmStatus("idle");
    setConfirmError("");
    setUserLabel("");
    setDatasetSampleId(null);

    return () => URL.revokeObjectURL(url);
  }, [file]);

  function resetLandmarker() {
    try {
      landmarkerRef.current?.close?.();
    } catch {
      // ignore
    }
    landmarkerRef.current = null;
    setActiveModel("unknown");
  }

  async function initLandmarkerIfNeeded() {
    if (landmarkerRef.current) return landmarkerRef.current;

    const overrides = {
      runningMode: "IMAGE", // IMPORTANT: photo only
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
    return landmarker;
  }

  async function analyzeCurrentImage() {
    try {
      if (!imageUrl) return;

      setStatus("loading");
      setError("");
      setPoseLandmarks(null);
      setPreview([]);
      setDerivedPreview([]);

      const canvas = canvasRef.current;
      const drawingUtils = drawingUtilsRef.current;
      if (!canvas || !drawingUtils) throw new Error("canvas non prêt");

      const img = await loadImageFromUrl(imageUrl);
      const landmarker = await initLandmarkerIfNeeded();

      // Resize canvas to image size
      const w = img.naturalWidth || img.width || 0;
      const h = img.naturalHeight || img.height || 0;
      if (!w || !h) throw new Error("Image invalide (dimensions 0)");

      canvas.width = w;
      canvas.height = h;
      setImageInfo((prev) => ({ ...prev, w, h }));

      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, w, h);

      // Draw image
      ctx.drawImage(img, 0, 0, w, h);

      // Detect
      const result = await safeDetectForImage(landmarker, img);
      const pose0 = result?.landmarks?.[0] ?? null;

      if (!pose0) {
        setPreview([]);
        setDerivedPreview([]);
        setPoseLandmarks(null);
        setStatus("done");
        return;
      }

      setPoseLandmarks(pose0);

      // Draw landmarks & connectors
      drawPose(drawingUtils, pose0);

      // Derived points
      const augmented = augmentPose(pose0);
      drawExtraPoints(ctx, augmented.extraOrder, w, h);

      // Table previews
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

      setStatus("done");
    } catch (e) {
      setStatus("error");
      setError(e?.message ?? String(e));
    }
  }

  async function runS3AndClassify() {
    try {
      if (!file) throw new Error("Aucune image sélectionnée");
      if (!userId?.trim()) throw new Error("userId requis");
      if (!poseLandmarks || poseLandmarks.length !== 33) {
        throw new Error("Landmarks manquants: détecte une pose sur l'image d'abord");
      }

      setFlowStatus("presign");
      setFlowError("");
      setPresign(null);
      setClassify(null);
      setConfirmStatus("idle");
      setConfirmError("");
      setUserLabel("");
      setDatasetSampleId(null);

      const contentType = file.type || "image/jpeg";

      const presignRes = await fetchJson("/api/uploads/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: userId.trim(), contentType }),
      });

      setPresign(presignRes);

      setFlowStatus("uploading");
      const putRes = await fetch(presignRes.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": contentType },
        body: file,
      });
      if (!putRes.ok) {
        const t = await putRes.text().catch(() => "");
        throw new Error(t || `S3 upload failed (HTTP ${putRes.status})`);
      }

      setFlowStatus("classifying");
      const meta = {
        source: "frontend",
        fileName: imageInfo.name || "",
        imageW: String(imageInfo.w || ""),
        imageH: String(imageInfo.h || ""),
        activeModel: String(activeModel || "unknown"),
      };

      const classifyRes = await fetchJson("/api/pose/classify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          analysisId: presignRes.analysisId,
          userId: userId.trim(),
          s3KeyImage: presignRes.s3KeyImage,
          landmarks: mapLandmarksForApi(poseLandmarks),
          meta,
        }),
      });

      setClassify(classifyRes);
      setUserLabel(classifyRes.pose || "");
      setFlowStatus("done");
    } catch (e) {
      setFlowStatus("error");
      setFlowError(e?.message ?? String(e));
    }
  }

  async function confirmLabel() {
    try {
      const analysisId = presign?.analysisId || classify?.analysisId;
      if (!analysisId) throw new Error("analysisId manquant (lance d'abord classify)");
      if (!userId?.trim()) throw new Error("userId requis");
      if (!userLabel?.trim()) throw new Error("userLabel requis");

      setConfirmStatus("confirming");
      setConfirmError("");
      setDatasetSampleId(null);

      const out = await fetchJson("/api/pose/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          analysisId,
          userId: userId.trim(),
          userLabel: userLabel.trim(),
        }),
      });

      setDatasetSampleId(out.datasetSampleId || null);
      setConfirmStatus("done");
    } catch (e) {
      setConfirmStatus("error");
      setConfirmError(e?.message ?? String(e));
    }
  }

  // Auto-analyze when a new image is selected
  useEffect(() => {
    if (!imageUrl) return;
    analyzeCurrentImage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageUrl]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      resetLandmarker();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const canAnalyze = !!imageUrl && status !== "loading";
  const canRunFlow = !!file && !!imageUrl && status !== "loading" && flowStatus !== "uploading" && flowStatus !== "classifying" && flowStatus !== "presign";
  const fileDisabled = status === "loading" || flowStatus === "uploading" || flowStatus === "classifying" || flowStatus === "presign";

  return (
    <section className="card">
      <PoseControls
        status={status}
        flowStatus={flowStatus}
        imageUrl={imageUrl}
        imageInfo={imageInfo}
        activeModel={activeModel}
        modelMode={modelMode}
        setModelMode={setModelMode}
        resetLandmarker={resetLandmarker}
        analyzeCurrentImage={analyzeCurrentImage}
        canAnalyze={canAnalyze}
        fileDisabled={fileDisabled}
        onPickFile={(e) => setFile(e.target.files?.[0] ?? null)}
        onClear={() => {
          setFile(null);
          setImageUrl("");
          setPreview([]);
          setDerivedPreview([]);
          setPoseLandmarks(null);
          setError("");
          setStatus("idle");
          setFlowStatus("idle");
          setFlowError("");
          setPresign(null);
          setClassify(null);
          setConfirmStatus("idle");
          setConfirmError("");
          setUserLabel("");
          setDatasetSampleId(null);
          const canvas = canvasRef.current;
          if (canvas) {
            const ctx = canvas.getContext("2d");
            ctx.clearRect(0, 0, canvas.width, canvas.height);
          }
        }}
        userId={userId}
        setUserId={setUserId}
        runS3AndClassify={runS3AndClassify}
        canRunFlow={canRunFlow}
        hasPoseLandmarks={!!poseLandmarks}
      />

      {error ? <p className="error">Erreur: {error}</p> : null}

      <div className="stage">
        <div className="videoWrap">
          <canvas ref={canvasRef} className="canvas" />
        </div>

        <div className="panel">
          <PoseResultPanel
            classify={classify}
            flowStatus={flowStatus}
            flowError={flowError}
            userLabel={userLabel}
            setUserLabel={setUserLabel}
            supportedPoses={SUPPORTED_POSES}
            confirmLabel={confirmLabel}
            confirmStatus={confirmStatus}
            confirmError={confirmError}
            datasetSampleId={datasetSampleId}
          />

          <PoseKeypointsPanel
            title="Points natifs utiles (extrait)"
            emptyText={imageUrl ? "Aucune pose détectée sur cette photo." : "Upload une photo pour voir les points."}
            rows={preview}
          />

          <PoseKeypointsPanel
            title="Points dérivés (virtual landmarks)"
            emptyText="Ils apparaîtront dès qu’une pose est détectée."
            rows={derivedPreview}
          />

          <p className="muted" style={{ marginTop: 10 }}>
            Important: ces points dérivés peuvent aussi être recalculés côté scoring (Python) à partir des 33 natifs.
          </p>
        </div>
      </div>
    </section>
  );
}