# services/scoring/app/pose_rules.py
from __future__ import annotations

import json
import logging
import os
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

logger = logging.getLogger("pose_rules")


@dataclass(frozen=True)
class P:
    x: float
    y: float
    z: float
    v: float  # visibility/confidence


def clamp01(x: float) -> float:
    return 0.0 if x < 0.0 else 1.0 if x > 1.0 else x


def in_range(value: float, lo: float, hi: float, soft_margin: float) -> float:
    """
    Soft membership of value in [lo, hi].
    - returns 1.0 when lo <= value <= hi
    - decays linearly to 0.0 when leaving [lo-soft_margin, hi+soft_margin]
    """
    if soft_margin <= 0:
        return 1.0 if lo <= value <= hi else 0.0

    if value < lo:
        if value <= lo - soft_margin:
            return 0.0
        return clamp01((value - (lo - soft_margin)) / soft_margin)
    if value > hi:
        if value >= hi + soft_margin:
            return 0.0
        return clamp01(((hi + soft_margin) - value) / soft_margin)
    return 1.0


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

    # angle = atan2(|u x v|, u·v)
    cross = bax * bcy - bay * bcx
    return degrees(atan2(abs(cross), dot))


def line_angle_deg(a: P, b: P) -> float:
    """Angle of segment a->b relative to +x axis, degrees in [-180,180]."""
    dx, dy = b.x - a.x, b.y - a.y
    return degrees(atan2(dy, dx))


def tilt_from_angle(angle_deg: float) -> float:
    """
    Convert a raw line angle (in degrees, relative to +x) into a "tilt from horizontal"
    in [0, 90], where:
      - 0   => perfectly horizontal
      - 90  => perfectly vertical
    """
    t = abs(angle_deg)
    if t > 180:
        t = 360 - t
    if t > 90:
        t = 180 - t
    return t


def closeness_to(target: float, value: float, tol: float) -> float:
    """1 when value==target, goes to 0 when |value-target|>=tol."""
    if tol <= 0:
        return 0.0
    return clamp01(1.0 - abs(value - target) / tol)


def body_scale(lms: List[P]) -> float:
    """
    IMPORTANT: for profile views, shoulder/hip *width* can be tiny.
    If we use only widths as the scale, normalized distances explode and
    downstream heuristics become unstable.

    So we include both widths AND lengths (torso, legs) to get a stable scale
    for "face or profile" shots.
    """
    ls, rs = get_point(lms, L_SHOULDER), get_point(lms, R_SHOULDER)
    lh, rh = get_point(lms, L_HIP), get_point(lms, R_HIP)
    la, ra = get_point(lms, L_ANKLE), get_point(lms, R_ANKLE)

    sh_mid = midpoint(ls, rs)
    hip_mid = midpoint(lh, rh)
    ank_mid = midpoint(la, ra)

    shoulder_w = dist2d(ls, rs)
    hip_w = dist2d(lh, rh)
    torso_len = dist2d(sh_mid, hip_mid)
    legs_len = dist2d(hip_mid, ank_mid)

    # use the largest of these; this makes profile shots stable
    return max(shoulder_w, hip_w, torso_len, legs_len, 1e-3)


def compute_features(lms: List[P]) -> Dict[str, float]:
    # Core joints (left/right)
    ls, rs = get_point(lms, L_SHOULDER), get_point(lms, R_SHOULDER)
    lh, rh = get_point(lms, L_HIP), get_point(lms, R_HIP)
    la, ra = get_point(lms, L_ANKLE), get_point(lms, R_ANKLE)
    lw, rw = get_point(lms, L_WRIST), get_point(lms, R_WRIST)
    le, re = get_point(lms, L_ELBOW), get_point(lms, R_ELBOW)
    lk, rk = get_point(lms, L_KNEE), get_point(lms, R_KNEE)
    nose = get_point(lms, NOSE)

    # Midpoints
    sh_mid = midpoint(ls, rs)
    hip_mid = midpoint(lh, rh)
    ank_mid = midpoint(la, ra)
    w_mid = midpoint(lw, rw)

    # Raw sizes
    shoulder_w = dist2d(ls, rs)
    hip_w = dist2d(lh, rh)
    torso_len = dist2d(sh_mid, hip_mid)
    legs_len = dist2d(hip_mid, ank_mid)
    width = max(shoulder_w, hip_w)
    length = max(torso_len, legs_len, 1e-6)
    width_ratio = width / length  # small => profile, large => frontal

    # View heuristic (0..1)
    profile_score = clamp01((0.35 - width_ratio) / 0.25)
    frontal_score = clamp01((width_ratio - 0.20) / 0.25)

    scale = body_scale(lms)

    # --- Local joint angles (2D, at the middle joint) ---
    elbow_l = angle_abc(ls, le, lw)
    elbow_r = angle_abc(rs, re, rw)

    knee_l = angle_abc(lh, lk, la)
    knee_r = angle_abc(rh, rk, ra)

    shoulder_l_ang = angle_abc(le, ls, lh)
    shoulder_r_ang = angle_abc(re, rs, rh)

    # Hip angles (2 versions)
    hip_l_ang = angle_abc(ls, lh, lk)     # shoulder-hip-knee
    hip_r_ang = angle_abc(rs, rh, rk)
    hip_l2_ang = angle_abc(ls, lh, la)    # shoulder-hip-ankle (more robust)
    hip_r2_ang = angle_abc(rs, rh, ra)

    neck_ang = angle_abc(hip_mid, sh_mid, nose)

    # --- Global segment orientations ---
    body_ang = line_angle_deg(sh_mid, ank_mid)
    torso_ang = line_angle_deg(sh_mid, hip_mid)
    legs_ang = line_angle_deg(hip_mid, ank_mid)
    arms_ang = line_angle_deg(sh_mid, w_mid)

    body_tilt = tilt_from_angle(body_ang)
    torso_tilt = tilt_from_angle(torso_ang)
    legs_tilt = tilt_from_angle(legs_ang)
    arms_tilt = tilt_from_angle(arms_ang)

    # --- Wrists relationship ---
    wrist_dy = abs(lw.y - rw.y)
    wrist_dx = abs(lw.x - rw.x)
    wrist_dy_signed = (lw.y - rw.y)

    # --- Relative y ordering helpers (y increases downward) ---
    y_wr = safe_mean(lw.y, rw.y)
    y_sh = safe_mean(ls.y, rs.y)
    y_hip = safe_mean(lh.y, rh.y)
    y_ank = safe_mean(la.y, ra.y)

    def soft_rel(y_a: float, y_b: float, tol: float = 0.05) -> float:
        if y_a >= y_b:
            return 0.0
        gap = y_b - y_a
        if gap >= tol:
            return 1.0
        return clamp01(gap / tol)

    score_legs_above_torso = soft_rel(y_ank, y_hip)
    score_legs_below_torso = soft_rel(y_hip, y_ank)
    score_hands_below_shoulders = soft_rel(y_sh, y_wr)
    score_hands_above_shoulders = soft_rel(y_wr, y_sh)

    score_lw_above_ls = soft_rel(lw.y, ls.y)
    score_rw_above_rs = soft_rel(rw.y, rs.y)
    score_lw_below_ls = soft_rel(ls.y, lw.y)
    score_rw_below_rs = soft_rel(rs.y, rw.y)

    score_shoulders_above_hips = soft_rel(y_sh, y_hip, tol=0.04)

    # --- Distances normalized ---
    d_wrist_sh = dist2d(w_mid, sh_mid) / scale
    d_sh_hip = dist2d(sh_mid, hip_mid) / scale
    d_hip_ank = dist2d(hip_mid, ank_mid) / scale
    d_hip_wrist = dist2d(hip_mid, w_mid) / scale

    d_torso_len = torso_len / scale
    d_legs_len = legs_len / scale

    d_lr_shoulder = shoulder_w / scale
    d_lr_hip = hip_w / scale
    d_lr_ankle = dist2d(la, ra) / scale
    d_lr_wrist = dist2d(lw, rw) / scale

    return {
        "scale": scale,
        "width_ratio": width_ratio,
        "profile_score": profile_score,
        "frontal_score": frontal_score,
        "elbow_l": elbow_l,
        "elbow_r": elbow_r,
        "knee_l": knee_l,
        "knee_r": knee_r,
        "shoulder_l_ang": shoulder_l_ang,
        "shoulder_r_ang": shoulder_r_ang,
        "hip_l_ang": hip_l_ang,
        "hip_r_ang": hip_r_ang,
        "hip_l2_ang": hip_l2_ang,
        "hip_r2_ang": hip_r2_ang,
        "neck_ang": neck_ang,
        "body_tilt": body_tilt,
        "torso_tilt": torso_tilt,
        "legs_tilt": legs_tilt,
        "arms_tilt": arms_tilt,
        "wrist_dy": wrist_dy,
        "wrist_dx": wrist_dx,
        "wrist_dy_signed": wrist_dy_signed,
        "y_wr": y_wr,
        "y_sh": y_sh,
        "y_hip": y_hip,
        "y_ank": y_ank,
        "score_legs_above_torso": score_legs_above_torso,
        "score_legs_below_torso": score_legs_below_torso,
        "score_hands_below_shoulders": score_hands_below_shoulders,
        "score_hands_above_shoulders": score_hands_above_shoulders,
        "score_lw_above_ls": score_lw_above_ls,
        "score_rw_above_rs": score_rw_above_rs,
        "score_lw_below_ls": score_lw_below_ls,
        "score_rw_below_rs": score_rw_below_rs,
        "score_shoulders_above_hips": score_shoulders_above_hips,
        "d_wrist_sh": d_wrist_sh,
        "d_sh_hip": d_sh_hip,
        "d_hip_ank": d_hip_ank,
        "d_hip_wrist": d_hip_wrist,
        "d_torso_len": d_torso_len,
        "d_legs_len": d_legs_len,
        "d_lr_shoulder": d_lr_shoulder,
        "d_lr_hip": d_lr_hip,
        "d_lr_ankle": d_lr_ankle,
        "d_lr_wrist": d_lr_wrist,
    }


def _hips_open_score(f: Dict[str, float]) -> float:
    left = max(closeness_to(180, f["hip_l_ang"], 25), closeness_to(180, f["hip_l2_ang"], 25))
    right = max(closeness_to(180, f["hip_r_ang"], 25), closeness_to(180, f["hip_r2_ang"], 25))
    return safe_mean(left, right)


def _hips_flexed_score_strict(f: Dict[str, float]) -> float:
    left = in_range(f["hip_l_ang"], 60, 120, 20) * in_range(f["hip_l2_ang"], 60, 120, 20)
    right = in_range(f["hip_r_ang"], 60, 120, 20) * in_range(f["hip_r2_ang"], 60, 120, 20)
    return safe_mean(left, right)


def _hips_flexed_score_soft(f: Dict[str, float]) -> float:
    left = safe_mean(in_range(f["hip_l_ang"], 60, 120, 20), in_range(f["hip_l2_ang"], 60, 120, 20))
    right = safe_mean(in_range(f["hip_r_ang"], 60, 120, 20), in_range(f["hip_r2_ang"], 60, 120, 20))
    return safe_mean(left, right)


def score_handstand(lms: List[P], f: Dict[str, float]) -> float:
    inv = f["score_legs_above_torso"]
    elbows = safe_mean(closeness_to(180, f["elbow_l"], 30), closeness_to(180, f["elbow_r"], 30))
    knees = safe_mean(closeness_to(180, f["knee_l"], 25), closeness_to(180, f["knee_r"], 25))
    vertical_body = closeness_to(90, f["body_tilt"], 18)
    vertical_legs = closeness_to(90, f["legs_tilt"], 18)
    arms_vertical = closeness_to(90, f["arms_tilt"], 20)
    hands_below = f["score_hands_below_shoulders"]
    support_dist = in_range(f["d_hip_wrist"], 0.3, 1.3, 0.4)

    base = clamp01(
        0.26 * inv
        + 0.14 * vertical_body
        + 0.10 * vertical_legs
        + 0.14 * arms_vertical
        + 0.18 * elbows
        + 0.08 * knees
        + 0.06 * hands_below
        + 0.04 * support_dist
    )
    anti_bar = clamp01(1.0 - 0.70 * f["score_hands_above_shoulders"])
    return clamp01(base * anti_bar)


def score_human_flag(lms: List[P], f: Dict[str, float]) -> float:
    view_gate = clamp01(0.35 + 0.65 * f["profile_score"])
    wrists_stacked = clamp01((f["wrist_dy"] - 0.18) / 0.25) * clamp01(1.0 - f["wrist_dx"] / 0.12)
    horizontal = closeness_to(0, f["body_tilt"], 15)
    arms_vertical = closeness_to(90, f["arms_tilt"], 20)
    hips_open = _hips_open_score(f)

    stacked_order_a = safe_mean(f["score_lw_above_ls"], f["score_rw_below_rs"])
    stacked_order_b = safe_mean(f["score_rw_above_rs"], f["score_lw_below_ls"])
    stacked_order = max(stacked_order_a, stacked_order_b)

    knees = safe_mean(closeness_to(180, f["knee_l"], 25), closeness_to(180, f["knee_r"], 25))
    elbows = safe_mean(closeness_to(180, f["elbow_l"], 35), closeness_to(180, f["elbow_r"], 35))

    return clamp01(
        view_gate
        * (
            0.30 * wrists_stacked
            + 0.18 * horizontal
            + 0.15 * arms_vertical
            + 0.15 * stacked_order
            + 0.10 * hips_open
            + 0.07 * elbows
            + 0.05 * knees
        )
    )


def score_planche(lms: List[P], f: Dict[str, float]) -> float:
    view_gate = clamp01(0.35 + 0.65 * f["profile_score"])

    hands_below = f["score_hands_below_shoulders"]
    horizontal = closeness_to(0, f["body_tilt"], 15)
    elbows = safe_mean(closeness_to(180, f["elbow_l"], 25), closeness_to(180, f["elbow_r"], 25))

    torso_horizontal = closeness_to(0, f["torso_tilt"], 18)
    legs_horizontal = closeness_to(0, f["legs_tilt"], 18)
    segments_horizontal = safe_mean(torso_horizontal, legs_horizontal)

    hips_open = _hips_open_score(f)
    hips_flexed = _hips_flexed_score_strict(f)

    knees = safe_mean(closeness_to(180, f["knee_l"], 25), closeness_to(180, f["knee_r"], 25))
    support = in_range(f["d_wrist_sh"], 0.3, 1.0, 0.35)

    hips_far = in_range(f["d_hip_wrist"], 0.70, 2.20, 0.45)

    base = clamp01(
        0.16 * hands_below
        + 0.20 * horizontal
        + 0.12 * segments_horizontal
        + 0.22 * elbows
        + 0.18 * hips_open
        + 0.04 * knees
        + 0.04 * support
        + 0.04 * hips_far
    )

    anti_l_sit = clamp01(1.0 - 0.75 * hips_flexed)
    return clamp01(view_gate * base * anti_l_sit)


def score_elbow_lever(lms: List[P], f: Dict[str, float]) -> float:
    view_gate = clamp01(0.35 + 0.65 * f["profile_score"])

    horizontal = closeness_to(0, f["body_tilt"], 18)
    elbow_bent = safe_mean(in_range(f["elbow_l"], 70, 120, 20), in_range(f["elbow_r"], 70, 120, 20))
    elbows_straight = safe_mean(closeness_to(180, f["elbow_l"], 25), closeness_to(180, f["elbow_r"], 25))

    hips_close = in_range(f["d_hip_wrist"], 0.15, 0.70, 0.25)
    hips_open = _hips_open_score(f)
    hips_flexed = _hips_flexed_score_soft(f)

    knees = safe_mean(closeness_to(180, f["knee_l"], 35), closeness_to(180, f["knee_r"], 35))
    hands_below = f["score_hands_below_shoulders"]

    base = clamp01(
        0.22 * horizontal
        + 0.26 * elbow_bent
        + 0.18 * hips_close
        + 0.10 * hips_open
        + 0.10 * knees
        + 0.14 * hands_below
    )

    anti_planche = clamp01(1.0 - 0.60 * elbows_straight)
    anti_l_sit = clamp01(1.0 - 0.45 * hips_flexed)
    return clamp01(view_gate * base * anti_planche * anti_l_sit)


def score_l_sit(lms: List[P], f: Dict[str, float]) -> float:
    view_gate = clamp01(0.35 + 0.65 * f["profile_score"])

    torso_vertical = closeness_to(90, f["torso_tilt"], 18)
    legs_horizontal = closeness_to(0, f["legs_tilt"], 18)

    # 🔥 Important vs planche: overall body axis becomes diagonal in L-sit
    body_diagonal = in_range(f["body_tilt"], 25, 75, 20)

    hips_flexed = _hips_flexed_score_soft(f)

    sh_above_hip = f["score_shoulders_above_hips"]
    elbows = safe_mean(closeness_to(180, f["elbow_l"], 30), closeness_to(180, f["elbow_r"], 30))
    hands_below = f["score_hands_below_shoulders"]

    hips_close = in_range(f["d_hip_wrist"], 0.10, 0.85, 0.30)

    base = clamp01(
        0.20 * torso_vertical
        + 0.12 * legs_horizontal
        + 0.18 * body_diagonal
        + 0.22 * hips_flexed
        + 0.10 * hips_close
        + 0.08 * elbows
        + 0.06 * hands_below
        + 0.04 * sh_above_hip
    )

    gate = clamp01(0.15 + 0.85 * torso_vertical) * clamp01(0.25 + 0.75 * body_diagonal)

    hips_open = _hips_open_score(f)
    planche_like = safe_mean(closeness_to(0, f["body_tilt"], 15), hips_open)
    anti_planche = clamp01(1.0 - 0.70 * planche_like)

    return clamp01(view_gate * base * gate * anti_planche)


def score_lever_generic(lms: List[P], f: Dict[str, float]) -> float:
    view_gate = clamp01(0.35 + 0.65 * f["profile_score"])

    horizontal = closeness_to(0, f["body_tilt"], 15)
    hands_above = f["score_hands_above_shoulders"]
    arms_vertical = closeness_to(90, f["arms_tilt"], 22)
    hips_open = _hips_open_score(f)
    elbows = safe_mean(closeness_to(180, f["elbow_l"], 30), closeness_to(180, f["elbow_r"], 30))
    knees = safe_mean(closeness_to(180, f["knee_l"], 30), closeness_to(180, f["knee_r"], 30))

    base = clamp01(
        0.28 * horizontal
        + 0.22 * hands_above
        + 0.12 * arms_vertical
        + 0.16 * hips_open
        + 0.12 * elbows
        + 0.10 * knees
    )

    anti_ground = clamp01(1.0 - 0.60 * f["score_hands_below_shoulders"])
    return clamp01(view_gate * base * anti_ground)


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
    la, ra = get_point(lms, L_ANKLE), get_point(lms, R_ANKLE)
    ankle_z = safe_mean(la.z, ra.z)

    return (hip_z - nose.z) + 0.30 * (ankle_z - nose.z) + 0.20 * (hip_z - shoulder_z)


def _maybe_log_debug(best_pose: str, best_conf: float, scores: Dict[str, float], f: Dict[str, float]) -> None:
    # log if POSE_DEBUG=1 OR if confidence is low (<0.65)
    if os.getenv("POSE_DEBUG", "0") != "1" and best_conf >= 0.65:
        return

    payload = {
        "best_pose": best_pose,
        "best_conf": round(best_conf, 3),
        "scores": {k: round(v, 3) for k, v in sorted(scores.items(), key=lambda kv: kv[0])},
        "view": {
            "profile_score": round(f["profile_score"], 3),
            "frontal_score": round(f["frontal_score"], 3),
            "width_ratio": round(f["width_ratio"], 3),
        },
        "key": {
            "body_tilt": round(f["body_tilt"], 2),
            "torso_tilt": round(f["torso_tilt"], 2),
            "legs_tilt": round(f["legs_tilt"], 2),
            "arms_tilt": round(f["arms_tilt"], 2),
            "hip_l_ang": round(f["hip_l_ang"], 1),
            "hip_r_ang": round(f["hip_r_ang"], 1),
            "hip_l2_ang": round(f["hip_l2_ang"], 1),
            "hip_r2_ang": round(f["hip_r2_ang"], 1),
            "d_hip_wrist": round(f["d_hip_wrist"], 3),
            "d_wrist_sh": round(f["d_wrist_sh"], 3),
            "scale": round(f["scale"], 4),
        },
    }
    logger.info("POSE_DEBUG %s", json.dumps(payload))


def classify_pose(lms: List[P], min_visibility: float = 0.4) -> Tuple[str, float, Dict[str, float], List[str]]:
    warnings: List[str] = []
    if len(lms) != 33:
        raise ValueError(f"Expected 33 landmarks, got {len(lms)}")

    low_vis = sum(1 for p in lms if p.v < min_visibility)
    if low_vis > 10:
        warnings.append(f"Low landmark visibility on {low_vis}/33 points (pose classification may be unreliable).")

    f = compute_features(lms)

    if f["profile_score"] < 0.35:
        warnings.append(
            "Angle caméra: essaie plutôt un profil net (de côté). Pour Planche/L-Sit/Levers/Elbow lever, le profil est beaucoup plus fiable."
        )

    scores: Dict[str, float] = {
        "Handstand": score_handstand(lms, f),
        "Human Flag": score_human_flag(lms, f),
        "Full Planche": score_planche(lms, f),
        "Elbow lever": score_elbow_lever(lms, f),
        "L-Sit": score_l_sit(lms, f),
    }

    lever_score = score_lever_generic(lms, f)
    hint = front_vs_back_hint(lms)

    front_boost = clamp01(0.5 + 0.25 * hint)
    back_boost = clamp01(0.5 - 0.25 * hint)
    scores["Front Lever"] = clamp01(lever_score * front_boost)
    scores["Back Lever"] = clamp01(lever_score * back_boost)

    best_pose = max(scores.items(), key=lambda kv: kv[1])[0]
    best_conf = float(scores[best_pose])

    _maybe_log_debug(best_pose, best_conf, scores, f)

    if best_conf < 0.55:
        warnings.append(f"I have low confidence ({best_conf:.2f}). Consider better framing: full body, good light, camera straight.")

    return best_pose, best_conf, scores, warnings
