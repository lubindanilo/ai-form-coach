// apps/frontend/src/lib/poseAugment.js

// Indices MediaPipe Pose (33 landmarks)
export const POSE_IDX = {
  NOSE: 0,
  LEFT_EAR: 7,
  RIGHT_EAR: 8,

  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,

  LEFT_ELBOW: 13,
  RIGHT_ELBOW: 14,

  LEFT_WRIST: 15,
  RIGHT_WRIST: 16,

  LEFT_HIP: 23,
  RIGHT_HIP: 24,

  LEFT_KNEE: 25,
  RIGHT_KNEE: 26,

  LEFT_ANKLE: 27,
  RIGHT_ANKLE: 28,

  LEFT_HEEL: 29,
  RIGHT_HEEL: 30,

  LEFT_FOOT_INDEX: 31,
  RIGHT_FOOT_INDEX: 32,
};

function isNum(x) {
  return typeof x === "number" && Number.isFinite(x);
}

function confFrom(lm) {
  const v = isNum(lm?.visibility) ? lm.visibility : null;
  const p = isNum(lm?.presence) ? lm.presence : null;
  if (isNum(v) && isNum(p)) return Math.min(v, p);
  if (isNum(v)) return v;
  if (isNum(p)) return p;
  return 0;
}

function avg2(a, b) {
  // a,b are landmarks with x,y,z, visibility/presence
  // If one missing -> return the other (better than zeros)
  if (!a && !b) return { x: 0, y: 0, z: 0, c: 0 };
  if (a && !b) return { x: a.x ?? 0, y: a.y ?? 0, z: a.z ?? 0, c: confFrom(a) };
  if (!a && b) return { x: b.x ?? 0, y: b.y ?? 0, z: b.z ?? 0, c: confFrom(b) };

  const ax = isNum(a.x) ? a.x : 0;
  const ay = isNum(a.y) ? a.y : 0;
  const az = isNum(a.z) ? a.z : 0;

  const bx = isNum(b.x) ? b.x : 0;
  const by = isNum(b.y) ? b.y : 0;
  const bz = isNum(b.z) ? b.z : 0;

  const c = Math.min(confFrom(a), confFrom(b));

  return {
    x: (ax + bx) / 2,
    y: (ay + by) / 2,
    z: (az + bz) / 2,
    c,
  };
}

/**
 * Augmente une pose MediaPipe (33 landmarks) avec des "virtual landmarks" utiles.
 * @param {Array} pose33 - result.landmarks[0] (length >= 33)
 * @returns {{ base: Array, extra: Object, extraOrder: Array<{name:string, lm:{x,y,z,c}}>} }
 */
export function augmentPose(pose33) {
  const base = Array.isArray(pose33) ? pose33 : null;

  const L_HIP = base?.[POSE_IDX.LEFT_HIP] ?? null;
  const R_HIP = base?.[POSE_IDX.RIGHT_HIP] ?? null;

  const L_SH = base?.[POSE_IDX.LEFT_SHOULDER] ?? null;
  const R_SH = base?.[POSE_IDX.RIGHT_SHOULDER] ?? null;

  const L_HEEL = base?.[POSE_IDX.LEFT_HEEL] ?? null;
  const R_HEEL = base?.[POSE_IDX.RIGHT_HEEL] ?? null;

  const L_FI = base?.[POSE_IDX.LEFT_FOOT_INDEX] ?? null;
  const R_FI = base?.[POSE_IDX.RIGHT_FOOT_INDEX] ?? null;

  const MID_HIP = avg2(L_HIP, R_HIP);
  const MID_SHOULDER = avg2(L_SH, R_SH);
  const TORSO_CENTER = avg2(MID_HIP, MID_SHOULDER);

  const LEFT_FOOT_MID = avg2(L_HEEL, L_FI);
  const RIGHT_FOOT_MID = avg2(R_HEEL, R_FI);

  const extra = {
    MID_HIP,
    MID_SHOULDER,
    TORSO_CENTER,
    LEFT_FOOT_MID,
    RIGHT_FOOT_MID,
  };

  const extraOrder = [
    { name: "MID_HIP", lm: MID_HIP },
    { name: "MID_SHOULDER", lm: MID_SHOULDER },
    { name: "TORSO_CENTER", lm: TORSO_CENTER },
    { name: "LEFT_FOOT_MID", lm: LEFT_FOOT_MID },
    { name: "RIGHT_FOOT_MID", lm: RIGHT_FOOT_MID },
  ];

  return { base, extra, extraOrder };
}