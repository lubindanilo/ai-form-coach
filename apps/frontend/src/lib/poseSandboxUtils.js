import { PoseLandmarker } from "@mediapipe/tasks-vision";

export function round4(v) {
  if (typeof v !== "number" || Number.isNaN(v)) return 0;
  return Math.round(v * 10000) / 10000;
}

export function confFrom(lm) {
  const v = typeof lm?.visibility === "number" ? lm.visibility : null;
  const p = typeof lm?.presence === "number" ? lm.presence : null;
  if (typeof v === "number" && typeof p === "number") return Math.min(v, p);
  if (typeof v === "number") return v;
  if (typeof p === "number") return p;
  return 0;
}

export function drawExtraPoints(ctx, extraOrder, w, h) {
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

export async function loadImageFromUrl(url) {
  return await new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Impossible de charger l'image"));
    img.src = url;
  });
}

/**
 * Compat: selon version tasks-vision
 * - detect(image) => result
 * - detect(image, cb) => void
 */
export async function safeDetectForImage(landmarker, imageElOrCanvas) {
  if (typeof landmarker?.detect !== "function") {
    throw new Error("Landmarker invalide: detect absent");
  }

  // callback signature
  if (landmarker.detect.length >= 2) {
    return await new Promise((resolve) => {
      landmarker.detect(imageElOrCanvas, (res) => resolve(res));
    });
  }

  // sync signature
  return landmarker.detect(imageElOrCanvas);
}

export function mapLandmarksForApi(lms) {
  if (!Array.isArray(lms)) return [];
  return lms.map((lm) => ({
    x: typeof lm?.x === "number" ? lm.x : 0,
    y: typeof lm?.y === "number" ? lm.y : 0,
    z: typeof lm?.z === "number" ? lm.z : 0,
    visibility:
      typeof lm?.visibility === "number"
        ? lm.visibility
        : typeof lm?.presence === "number"
          ? lm.presence
          : 0,
  }));
}

export async function fetchJson(url, options) {
  const res = await fetch(url, options);
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (!res.ok) {
    const msg = data?.error || data?.message || text || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

export function drawPose(drawingUtils, pose0) {
  drawingUtils.drawLandmarks(pose0, { radius: 2 });
  drawingUtils.drawConnectors(pose0, PoseLandmarker.POSE_CONNECTIONS);
}

