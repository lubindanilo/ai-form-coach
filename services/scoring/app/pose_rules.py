# services/scoring/app/pose_rules.py
from __future__ import annotations

from dataclasses import dataclass
from math import atan2, degrees, sqrt
from typing import Dict, List, Tuple, Optional


# MediaPipe Pose landmark indices (subset we use a lot)
NOSE = 0
L_SHOULDER, R_SHOULDER = 11, 12
L_ELBOW, R_ELBOW = 13, 14
L_WRIST, R_WRIST = 15, 16
L_HIP, R_HIP = 23, 24
L_KNEE, R_KNEE = 25, 26
L_ANKLE, R_ANKLE = 27, 28
L_FOOT, R_FOOT = 31, 32


POSES = [
    "Full Planche",
    "L-Sit",
    "Front Lever",
    "Human Flag",
    "Handstand",
    "Elbow lever",
    "Back Lever",
]


@dataclass(frozen=True)
class P:
    x: float
    y: float
    z: float
    v: float  # visibility/confidence


def clamp01(x: float) -> float:
    return 0.0 if x < 0.0 else 1.0 if x > 1.0 else x


def safe_mean(a: float, b: float) -> float:
    return (a + b) / 2.0


def get_point(lms: List[P], idx: int) -> P:
    return lms[idx]


def midpoint(a: P, b: P) -> P:
    return P(safe_mean(a.x, b.x), safe_mean(a.y, b.y), safe_mean(a.z, b.z), safe_mean(a.v, b.v))


def dist2d(a: P, b: P) -> float:
    dx, dy = a.x - b.x, a.y - b.y
    return sqrt(dx * dx + dy * dy)


def angle_abc(a: P, b: P, c: P) -> float:
    """Angle at point b, in degrees, using 2D (x,y)."""
    bax, bay = a.x - b.x, a.y - b.y
    bcx, bcy = c.x - b.x, c.y - b.y

    dot = bax * bcx + bay * bcy
    na = sqrt(bax * bax + bay * bay)
    nc = sqrt(bcx * bcx + bcy * bcy)
    if na < 1e-6 or nc < 1e-6:
        return 0.0

    cosang = max(-1.0, min(1.0, dot / (na * nc)))
    # arccos without importing; use atan2 trick:
    # angle = atan2(|u x v|, u·v)
    cross = bax * bcy - bay * bcx
    ang = degrees(atan2(abs(cross), dot))
    return ang


def line_angle_deg(a: P, b: P) -> float:
    """Angle of segment a->b relative to +x axis, degrees in [-180,180]."""
    dx, dy = b.x - a.x, b.y - a.y
    return degrees(atan2(dy, dx))


def closeness_to(target: float, value: float, tol: float) -> float:
    """1 when value==target, goes to 0 when |value-target|>=tol."""
    if tol <= 0:
        return 0.0
    return clamp01(1.0 - abs(value - target) / tol)


def vis_ok(points: List[P], min_v: float = 0.5) -> bool:
    return all(p.v >= min_v for p in points)


def body_scale(lms: List[P]) -> float:
    # robust-ish scale: shoulder width or hip width (fallback to 1 if weird)
    ls, rs = get_point(lms, L_SHOULDER), get_point(lms, R_SHOULDER)
    lh, rh = get_point(lms, L_HIP), get_point(lms, R_HIP)
    s = dist2d(ls, rs)
    h = dist2d(lh, rh)
    scale = max(s, h, 1e-3)
    return scale


def compute_features(lms: List[P]) -> Dict[str, float]:
    ls, rs = get_point(lms, L_SHOULDER), get_point(lms, R_SHOULDER)
    lh, rh = get_point(lms, L_HIP), get_point(lms, R_HIP)
    la, ra = get_point(lms, L_ANKLE), get_point(lms, R_ANKLE)
    lw, rw = get_point(lms, L_WRIST), get_point(lms, R_WRIST)
    le, re = get_point(lms, L_ELBOW), get_point(lms, R_ELBOW)
    lk, rk = get_point(lms, L_KNEE), get_point(lms, R_KNEE)

    sh_mid = midpoint(ls, rs)
    hip_mid = midpoint(lh, rh)
    ank_mid = midpoint(la, ra)
    w_mid = midpoint(lw, rw)

    scale = body_scale(lms)

    # angles
    elbow_l = angle_abc(ls, le, lw)
    elbow_r = angle_abc(rs, re, rw)
    knee_l = angle_abc(lh, lk, la)
    knee_r = angle_abc(rh, rk, ra)

    body_ang = line_angle_deg(sh_mid, ank_mid)  # horizontal ~ 0/180, vertical ~ +/-90
    torso_ang = line_angle_deg(sh_mid, hip_mid)

    # normalize angles to [0,180] "tilt from horizontal"
    body_tilt = abs(body_ang)
    if body_tilt > 180:
        body_tilt = 360 - body_tilt
    if body_tilt > 90:
        body_tilt = 180 - body_tilt  # now in [0,90], 0=horizontal, 90=vertical

    torso_tilt = abs(torso_ang)
    if torso_tilt > 180:
        torso_tilt = 360 - torso_tilt
    if torso_tilt > 90:
        torso_tilt = 180 - torso_tilt

    # wrists vertical gap (human flag signature)
    wrist_dy = abs(lw.y - rw.y)
    wrist_dx = abs(lw.x - rw.x)

    # relative y ordering helpers (y increases downward in image)
    y_wr = safe_mean(lw.y, rw.y)
    y_sh = safe_mean(ls.y, rs.y)
    y_hip = safe_mean(lh.y, rh.y)
    y_ank = safe_mean(la.y, ra.y)

    # distances normalized
    d_wrist_sh = dist2d(w_mid, sh_mid) / scale
    d_sh_hip = dist2d(sh_mid, hip_mid) / scale
    d_hip_ank = dist2d(hip_mid, ank_mid) / scale

    return {
        "scale": scale,
        "elbow_l": elbow_l,
        "elbow_r": elbow_r,
        "knee_l": knee_l,
        "knee_r": knee_r,
        "body_tilt": body_tilt,    # 0=horizontal, 90=vertical
        "torso_tilt": torso_tilt,  # 0=horizontal, 90=vertical
        "wrist_dy": wrist_dy,
        "wrist_dx": wrist_dx,
        "y_wr": y_wr,
        "y_sh": y_sh,
        "y_hip": y_hip,
        "y_ank": y_ank,
        "d_wrist_sh": d_wrist_sh,
        "d_sh_hip": d_sh_hip,
        "d_hip_ank": d_hip_ank,
    }


def score_handstand(lms: List[P], f: Dict[str, float]) -> float:
    # Inversion order: ankles above hips above shoulders above wrists (smaller y is "higher")
    inv = 1.0 if (f["y_ank"] < f["y_hip"] < f["y_sh"] < f["y_wr"]) else 0.0

    # Straight limbs
    elbows = safe_mean(closeness_to(180, f["elbow_l"], 30), closeness_to(180, f["elbow_r"], 30))
    knees = safe_mean(closeness_to(180, f["knee_l"], 25), closeness_to(180, f["knee_r"], 25))

    # Body vertical
    vertical = closeness_to(90, f["body_tilt"], 18)

    # Hands roughly under shoulders (in x): we approximate by wrist->shoulder distance not too large
    hands_close = closeness_to(0.6, f["d_wrist_sh"], 0.5)  # wide tolerance

    return clamp01(0.35 * inv + 0.25 * vertical + 0.20 * elbows + 0.15 * knees + 0.05 * hands_close)


def score_human_flag(lms: List[P], f: Dict[str, float]) -> float:
    # Signature: wrists stacked vertically (big dy, small dx) + body horizontal
    wrists_stacked = clamp01((f["wrist_dy"] - 0.18) / 0.25) * clamp01(1.0 - f["wrist_dx"] / 0.12)
    horizontal = closeness_to(0, f["body_tilt"], 15)
    knees = safe_mean(closeness_to(180, f["knee_l"], 25), closeness_to(180, f["knee_r"], 25))
    elbows = safe_mean(closeness_to(180, f["elbow_l"], 35), closeness_to(180, f["elbow_r"], 35))
    return clamp01(0.45 * wrists_stacked + 0.30 * horizontal + 0.15 * knees + 0.10 * elbows)


def score_planche(lms: List[P], f: Dict[str, float]) -> float:
    # Hands lower than shoulders, body horizontal, elbows straight
    hands_below = 1.0 if f["y_wr"] > f["y_sh"] else 0.0
    horizontal = closeness_to(0, f["body_tilt"], 15)
    elbows = safe_mean(closeness_to(180, f["elbow_l"], 25), closeness_to(180, f["elbow_r"], 25))
    knees = safe_mean(closeness_to(180, f["knee_l"], 25), closeness_to(180, f["knee_r"], 25))
    # shoulders relatively close to wrists (planche support)
    support = closeness_to(0.5, f["d_wrist_sh"], 0.35)
    return clamp01(0.25 * hands_below + 0.30 * horizontal + 0.25 * elbows + 0.10 * knees + 0.10 * support)


def score_elbow_lever(lms: List[P], f: Dict[str, float]) -> float:
    # Elbow lever: body horizontal like planche BUT elbows bent (~70-120 deg)
    horizontal = closeness_to(0, f["body_tilt"], 18)
    elbow_bent = safe_mean(closeness_to(95, f["elbow_l"], 35), closeness_to(95, f["elbow_r"], 35))
    knees = safe_mean(closeness_to(180, f["knee_l"], 35), closeness_to(180, f["knee_r"], 35))
    hands_below = 1.0 if f["y_wr"] > f["y_sh"] else 0.0
    return clamp01(0.35 * horizontal + 0.35 * elbow_bent + 0.15 * knees + 0.15 * hands_below)


def score_l_sit(lms: List[P], f: Dict[str, float]) -> float:
    # Torso vertical + legs horizontal and raised near hip level
    torso_vertical = closeness_to(90, f["torso_tilt"], 20)
    legs_horizontal = closeness_to(0, f["body_tilt"], 18)
    legs_raised = closeness_to(0.0, abs(f["y_hip"] - f["y_ank"]), 0.10)  # same height
    elbows = safe_mean(closeness_to(180, f["elbow_l"], 30), closeness_to(180, f["elbow_r"], 30))
    hands_below = 1.0 if f["y_wr"] > f["y_sh"] else 0.0
    return clamp01(0.25 * torso_vertical + 0.25 * legs_horizontal + 0.20 * legs_raised + 0.20 * elbows + 0.10 * hands_below)


def score_lever_generic(lms: List[P], f: Dict[str, float]) -> float:
    # Lever: body horizontal + hands above shoulders (bar overhead) + straight limbs
    horizontal = closeness_to(0, f["body_tilt"], 15)
    hands_above = 1.0 if f["y_wr"] < f["y_sh"] else 0.0
    elbows = safe_mean(closeness_to(180, f["elbow_l"], 30), closeness_to(180, f["elbow_r"], 30))
    knees = safe_mean(closeness_to(180, f["knee_l"], 30), closeness_to(180, f["knee_r"], 30))
    return clamp01(0.40 * horizontal + 0.20 * hands_above + 0.20 * elbows + 0.20 * knees)


def front_vs_back_hint(lms: List[P]) -> float:
    """
    Naive hint using z: MediaPipe z is roughly "depth". This is not perfect.
    Returns >0 => front lever likely, <0 => back lever likely.
    """
    ls, rs = get_point(lms, L_SHOULDER), get_point(lms, R_SHOULDER)
    lh, rh = get_point(lms, L_HIP), get_point(lms, R_HIP)
    nose = get_point(lms, NOSE)

    shoulder_z = safe_mean(ls.z, rs.z)
    hip_z = safe_mean(lh.z, rh.z)

    # if face (nose) is closer to camera than hips, lean "front"
    return (hip_z - nose.z) + 0.3 * (hip_z - shoulder_z)


def classify_pose(lms: List[P], min_visibility: float = 0.4) -> Tuple[str, float, Dict[str, float], List[str]]:
    warnings: List[str] = []
    if len(lms) != 33:
        raise ValueError(f"Expected 33 landmarks, got {len(lms)}")

    # basic visibility sanity: if too many low-vis points, warn
    low_vis = sum(1 for p in lms if p.v < min_visibility)
    if low_vis > 10:
        warnings.append(f"Low landmark visibility on {low_vis}/33 points (pose classification may be unreliable).")

    f = compute_features(lms)

    scores: Dict[str, float] = {
        "Handstand": score_handstand(lms, f),
        "Human Flag": score_human_flag(lms, f),
        "Full Planche": score_planche(lms, f),
        "Elbow lever": score_elbow_lever(lms, f),
        "L-Sit": score_l_sit(lms, f),
    }

    lever_score = score_lever_generic(lms, f)
    hint = front_vs_back_hint(lms)
    # split lever score into front/back based on hint (soft split)
    front_boost = clamp01(0.5 + 0.25 * hint)   # very tolerant
    back_boost = clamp01(0.5 - 0.25 * hint)
    scores["Front Lever"] = clamp01(lever_score * front_boost)
    scores["Back Lever"] = clamp01(lever_score * back_boost)

    # pick best
    best_pose = max(scores.items(), key=lambda kv: kv[1])[0]
    best_conf = float(scores[best_pose])

    # if very low confidence, still output best (required) but warn
    if best_conf < 0.55:
        warnings.append(f"Low confidence ({best_conf:.2f}). Consider better framing: full body, good light, camera straight.")

    return best_pose, best_conf, scores, warnings

