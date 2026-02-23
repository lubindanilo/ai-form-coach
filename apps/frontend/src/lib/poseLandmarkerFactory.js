import { FilesetResolver, PoseLandmarker } from "@mediapipe/tasks-vision";

const VISION_WASM_BASE =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm";

let visionPromise = null;

async function getVision() {
  if (!visionPromise) {
    visionPromise = FilesetResolver.forVisionTasks(VISION_WASM_BASE);
  }
  return visionPromise;
}

function buildOptions(modelAssetPath, overrides = {}) {
  const base = {
    baseOptions: {
      modelAssetPath,
      // delegate: "GPU", // optionnel
    },
    // IMPORTANT: VIDEO marche très bien pour webcam + upload (on fournit tsMs)
    runningMode: "VIDEO",
    numPoses: 1,
    minPoseDetectionConfidence: 0.5,
    minPosePresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
    outputSegmentationMasks: false,
  };

  return {
    ...base,
    ...overrides,
    baseOptions: {
      ...base.baseOptions,
      ...(overrides.baseOptions || {}),
    },
  };
}

export async function createPoseLandmarkerDirect(modelAssetPath, overrides = {}) {
  const vision = await getVision();
  const options = buildOptions(modelAssetPath, overrides);
  return await PoseLandmarker.createFromOptions(vision, options);
}

export async function createPoseLandmarkerWithFallback({
  primaryModelPath,
  fallbackModelPath,
  primaryName = "full",
  fallbackName = "lite",
  overrides = {},
}) {
  try {
    const landmarker = await createPoseLandmarkerDirect(primaryModelPath, overrides);
    return { landmarker, activeModel: primaryName, usedFallback: false };
  } catch (e1) {
    // eslint-disable-next-line no-console
    console.warn(
      `[PoseLandmarker] Failed to load primary model (${primaryName}). Falling back to ${fallbackName}.`,
      e1
    );
    const landmarker = await createPoseLandmarkerDirect(fallbackModelPath, overrides);
    return { landmarker, activeModel: fallbackName, usedFallback: true };
  }
}