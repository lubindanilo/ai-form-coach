from __future__ import annotations

from dataclasses import dataclass
from math import atan2, degrees, sqrt
from typing import Dict, List


# MediaPipe Pose landmark indices (subset we use a lot)
NOSE = 0
L_SHOULDER, R_SHOULDER = 11, 12
L_ELBOW, R_ELBOW = 13, 14
L_WRIST, R_WRIST = 15, 16
L_HIP, R_HIP = 23, 24
L_KNEE, R_KNEE = 25, 26
L_ANKLE, R_ANKLE = 27, 28


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


def in_range(value: float, lo: float, hi: float, soft_margin: float) -> float:
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


def closeness_to(target: float, value: float, tol: float) -> float:
    if tol <= 0:
        return 0.0
    return clamp01(1.0 - abs(value - target) / tol)


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
    na = sqrt(bax * bax + bay * bay)
    nc = sqrt(bcx * bcx + bcy * bcy)
    if na < 1e-6 or nc < 1e-6:
        return 0.0
    cross = bax * bcy - bay * bcx
    dot = bax * bcx + bay * bcy
    return degrees(atan2(abs(cross), dot))


def line_angle_deg(a: P, b: P) -> float:
    dx, dy = b.x - a.x, b.y - a.y
    return degrees(atan2(dy, dx))


def tilt_from_angle(angle_deg: float) -> float:
    """Tilt from horizontal in [0,90]."""
    t = abs(angle_deg)
    if t > 180:
        t = 360 - t
    if t > 90:
        t = 180 - t
    return t


def body_scale(lms: List[P]) -> float:
    """
    ✅ Profil-safe: en vue de profil, la largeur épaules/hanches peut être minuscule.
    Donc on prend aussi des longueurs (torse/jambes) pour stabiliser les distances normalisées.
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

    return max(shoulder_w, hip_w, torso_len, legs_len, 1e-3)


def _soft_rel_above(y_a: float, y_b: float, tol: float = 0.05) -> float:
    """Soft score that y_a is above y_b (y_a < y_b). y increases downward."""
    if y_a >= y_b:
        return 0.0
    gap = y_b - y_a
    if gap >= tol:
        return 1.0
    return clamp01(gap / tol)


def compute_features(lms: List[P], min_visibility: float, warnings: List[str]) -> Dict[str, float]:
    if len(lms) != 33:
        raise ValueError(f"Expected 33 landmarks, got {len(lms)}")

    low_vis = sum(1 for p in lms if p.v < min_visibility)
    if low_vis > 10:
        warnings.append(f"Low landmark visibility on {low_vis}/33 points (pose classification may be unreliable).")

    # points
    ls, rs = get_point(lms, L_SHOULDER), get_point(lms, R_SHOULDER)
    lh, rh = get_point(lms, L_HIP), get_point(lms, R_HIP)
    la, ra = get_point(lms, L_ANKLE), get_point(lms, R_ANKLE)
    lw, rw = get_point(lms, L_WRIST), get_point(lms, R_WRIST)
    le, re = get_point(lms, L_ELBOW), get_point(lms, R_ELBOW)
    lk, rk = get_point(lms, L_KNEE), get_point(lms, R_KNEE)
    nose = get_point(lms, NOSE)

    sh_mid = midpoint(ls, rs)
    hip_mid = midpoint(lh, rh)
    ank_mid = midpoint(la, ra)
    w_mid = midpoint(lw, rw)

    shoulder_w = dist2d(ls, rs)
    hip_w = dist2d(lh, rh)
    torso_len = dist2d(sh_mid, hip_mid)
    legs_len = dist2d(hip_mid, ank_mid)

    width = max(shoulder_w, hip_w)
    length = max(torso_len, legs_len, 1e-6)
    width_ratio = width / length  # profil => petit

    profile_score = clamp01((0.35 - width_ratio) / 0.25)
    frontal_score = clamp01((width_ratio - 0.20) / 0.25)

    scale = body_scale(lms)

    # angles
    elbow_l = angle_abc(ls, le, lw)
    elbow_r = angle_abc(rs, re, rw)
    knee_l = angle_abc(lh, lk, la)
    knee_r = angle_abc(rh, rk, ra)

    shoulder_l_ang = angle_abc(le, ls, lh)
    shoulder_r_ang = angle_abc(re, rs, rh)

    # hip angles: 2 versions (knee + ankle)
    hip_l_ang = angle_abc(ls, lh, lk)
    hip_r_ang = angle_abc(rs, rh, rk)
    hip_l2_ang = angle_abc(ls, lh, la)
    hip_r2_ang = angle_abc(rs, rh, ra)

    neck_ang = angle_abc(hip_mid, sh_mid, nose)

    # tilts
    body_tilt = tilt_from_angle(line_angle_deg(sh_mid, ank_mid))
    torso_tilt = tilt_from_angle(line_angle_deg(sh_mid, hip_mid))
    legs_tilt = tilt_from_angle(line_angle_deg(hip_mid, ank_mid))
    arms_tilt = tilt_from_angle(line_angle_deg(sh_mid, w_mid))

    wrist_dy = abs(lw.y - rw.y)
    wrist_dx = abs(lw.x - rw.x)

    y_wr = safe_mean(lw.y, rw.y)
    y_sh = safe_mean(ls.y, rs.y)
    y_hip = safe_mean(lh.y, rh.y)
    y_ank = safe_mean(la.y, ra.y)

    score_legs_above_torso = _soft_rel_above(y_ank, y_hip)
    score_legs_below_torso = _soft_rel_above(y_hip, y_ank)
    score_hands_below_shoulders = _soft_rel_above(y_sh, y_wr)
    score_hands_above_shoulders = _soft_rel_above(y_wr, y_sh)

    score_lw_above_ls = _soft_rel_above(lw.y, ls.y)
    score_rw_above_rs = _soft_rel_above(rw.y, rs.y)
    score_lw_below_ls = _soft_rel_above(ls.y, lw.y)
    score_rw_below_rs = _soft_rel_above(rs.y, rw.y)

    score_shoulders_above_hips = _soft_rel_above(y_sh, y_hip, tol=0.04)

    # distances normalized
    d_wrist_sh = dist2d(w_mid, sh_mid) / scale
    d_hip_wrist = dist2d(hip_mid, w_mid) / scale

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
        "d_hip_wrist": d_hip_wrist,
    }


# ---- Helpers partagés pour les scorers ----

def hips_open_score(f: Dict[str, float]) -> float:
    left = max(closeness_to(180, f["hip_l_ang"], 25), closeness_to(180, f["hip_l2_ang"], 25))
    right = max(closeness_to(180, f["hip_r_ang"], 25), closeness_to(180, f["hip_r2_ang"], 25))
    return safe_mean(left, right)


def hips_flexed_soft(f: Dict[str, float]) -> float:
    left = safe_mean(in_range(f["hip_l_ang"], 60, 120, 20), in_range(f["hip_l2_ang"], 60, 120, 20))
    right = safe_mean(in_range(f["hip_r_ang"], 60, 120, 20), in_range(f["hip_r2_ang"], 60, 120, 20))
    return safe_mean(left, right)


def hips_flexed_strict(f: Dict[str, float]) -> float:
    left = in_range(f["hip_l_ang"], 60, 120, 20) * in_range(f["hip_l2_ang"], 60, 120, 20)
    right = in_range(f["hip_r_ang"], 60, 120, 20) * in_range(f["hip_r2_ang"], 60, 120, 20)
    return safe_mean(left, right)


def front_vs_back_hint(lms: List[P]) -> float:
    """>0 front lever likely, <0 back lever likely (naif, basé sur z)."""
    ls, rs = get_point(lms, L_SHOULDER), get_point(lms, R_SHOULDER)
    lh, rh = get_point(lms, L_HIP), get_point(lms, R_HIP)
    nose = get_point(lms, NOSE)
    la, ra = get_point(lms, L_ANKLE), get_point(lms, R_ANKLE)

    shoulder_z = safe_mean(ls.z, rs.z)
    hip_z = safe_mean(lh.z, rh.z)
    ankle_z = safe_mean(la.z, ra.z)

    return (hip_z - nose.z) + 0.30 * (ankle_z - nose.z) + 0.20 * (hip_z - shoulder_z)
