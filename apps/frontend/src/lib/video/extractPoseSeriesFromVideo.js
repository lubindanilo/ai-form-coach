import { seekTo, waitForVideoMetadata } from "./videoSeekUtils.js";

/**
 * Extrait une time-series de landmarks MediaPipe Pose à partir d'un <video>.
 *
 * Output MVP:
 * series = [{ t: timestampMs, landmarks: [...33], worldLandmarks: [...33] } ...]
 */
export async function extractPoseSeriesFromVideo({
  videoEl,
  landmarker,
  fps = 15,
  onProgress,
  shouldCancel,
}) {
  if (!videoEl) throw new Error("videoEl manquant");
  if (!landmarker) throw new Error("landmarker manquant");

  await waitForVideoMetadata(videoEl);

  const durationSec = videoEl.duration;
  if (!Number.isFinite(durationSec) || durationSec <= 0) {
    throw new Error("Durée vidéo invalide");
  }

  const stepSec = 1 / Math.max(1, fps);
  const totalSteps = Math.max(1, Math.ceil(durationSec / stepSec));

  const series = [];
  let i = 0;

  for (let tSec = 0; tSec < durationSec; tSec += stepSec) {
    if (shouldCancel?.()) break;

    await seekTo(videoEl, tSec);

    // timestamp "cohérent" : MediaPipe se sert du ts pour son tracking interne
    const tsMs = Math.round(tSec * 1000);

    const result = await safeDetectForVideo(landmarker, videoEl, tsMs);
    series.push({
      t: tsMs,
      landmarks: result?.landmarks?.[0] ?? null,
      worldLandmarks: result?.worldLandmarks?.[0] ?? null,
    });

    i += 1;
    if (onProgress) onProgress(Math.min(1, i / totalSteps));
  }

  return series;
}

/**
 * Compat: certaines versions de tasks-vision exposent detectForVideo(video, ts, cb)
 * d'autres: detectForVideo(video, ts) => result
 */
async function safeDetectForVideo(landmarker, videoEl, tsMs) {
  if (typeof landmarker?.detectForVideo !== "function") {
    throw new Error("Landmarker invalide: detectForVideo absent");
  }

  // callback signature
  if (landmarker.detectForVideo.length >= 3) {
    return await new Promise((resolve) => {
      landmarker.detectForVideo(videoEl, tsMs, (res) => resolve(res));
    });
  }

  // sync signature
  return landmarker.detectForVideo(videoEl, tsMs);
}