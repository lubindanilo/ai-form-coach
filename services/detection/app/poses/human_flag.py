from __future__ import annotations
from typing import Dict, List

from ..pose_features import (
    P, clamp01, closeness_to, in_range, safe_mean,
    hips_open_score, hips_flexed_soft,
    get_point, midpoint, dist2d, line_angle_deg, tilt_from_angle,
    L_SHOULDER, R_SHOULDER, L_WRIST, R_WRIST
)


def _soft_above(y_a: float, y_b: float, tol: float = 0.05) -> float:
    """
    Score soft que y_a soit au-dessus de y_b.
    Rappel: en image, y augmente vers le bas.
    """
    if y_a >= y_b:
        return 0.0
    gap = y_b - y_a
    if gap >= tol:
        return 1.0
    return clamp01(gap / tol)


def _sort_by_y(a: P, b: P) -> tuple[P, P]:
    return (a, b) if a.y <= b.y else (b, a)


def score(lms: List[P], f: Dict[str, float]) -> float:
    # Human flag : le profil reste utile, mais on le gate un peu moins agressivement
    view_gate = clamp01(0.45 + 0.55 * f["profile_score"])

    # Raw landmarks utiles pour éviter la fragilité gauche/droite
    ls, rs = get_point(lms, L_SHOULDER), get_point(lms, R_SHOULDER)
    lw, rw = get_point(lms, L_WRIST), get_point(lms, R_WRIST)

    sh_mid = midpoint(ls, rs)
    w_mid = midpoint(lw, rw)
    scale = max(f.get("scale", 1.0), 1e-6)

    # --- 1) Corps horizontal ---
    horizontal = closeness_to(0, f["body_tilt"], 16)
    torso_horizontal = closeness_to(0, f["torso_tilt"], 18)
    legs_horizontal = closeness_to(0, f["legs_tilt"], 18)
    segments_horizontal = safe_mean(torso_horizontal, legs_horizontal)

    # --- 2) Colonne de support (les deux poignets autour d'un axe vertical) ---
    support_line_tilt = tilt_from_angle(line_angle_deg(lw, rw))
    support_vertical = closeness_to(90, support_line_tilt, 28)

    # poignets suffisamment séparés verticalement
    wrist_gap_norm = dist2d(lw, rw) / scale
    wrists_separated = in_range(wrist_gap_norm, 0.25, 1.80, 0.20)

    # poignets pas trop écartés horizontalement (tolérance plus large qu'avant)
    same_column = clamp01(1.0 - f["wrist_dx"] / 0.22)

    support_column = clamp01(
        0.45 * support_vertical
        + 0.30 * wrists_separated
        + 0.25 * same_column
    )

    # --- 3) Main haute / main basse robustes sans dépendre de left/right ---
    top_w, bot_w = _sort_by_y(lw, rw)
    top_s, bot_s = _sort_by_y(ls, rs)

    top_hand_above_shoulders = _soft_above(top_w.y, top_s.y, tol=0.06)
    bottom_hand_below_shoulders = _soft_above(bot_s.y, bot_w.y, tol=0.06)

    stacked_order = safe_mean(top_hand_above_shoulders, bottom_hand_below_shoulders)

    # --- 4) Les mains doivent être latéralement décalées du tronc ---
    # sur un human flag, le support n'est pas "dans" le torse
    lateral_offset = abs(w_mid.x - sh_mid.x) / scale
    support_side = in_range(lateral_offset, 0.08, 0.90, 0.10)

    elbows_straight = safe_mean(
        closeness_to(180, f["elbow_l"], 30),
        closeness_to(180, f["elbow_r"], 30),
    )
    knees_straight = safe_mean(
        closeness_to(180, f["knee_l"], 30),
        closeness_to(180, f["knee_r"], 30),
    )

    hips_open = hips_open_score(f)
    hips_flexed = hips_flexed_soft(f)

    base = clamp01(
        0.22 * horizontal
        + 0.12 * segments_horizontal
        + 0.24 * support_column
        + 0.18 * stacked_order
        + 0.08 * support_side
        + 0.08 * elbows_straight
        + 0.04 * knees_straight
        + 0.04 * hips_open
    )

    # --- Pénalités anti-confusion ---
    # Front/Back lever : corps horizontal, mais pas une vraie colonne verticale de support
    anti_lever = clamp01(
        1.0
        - 0.35 * f["score_hands_above_shoulders"]
        - 0.30 * clamp01(1.0 - support_column)
    )

    # Planche / elbow lever : mains sous épaules
    anti_ground = clamp01(1.0 - 0.65 * f["score_hands_below_shoulders"])

    # L-Sit : hanches fléchies
    anti_lsit = clamp01(1.0 - 0.55 * hips_flexed)

    # Handstand : corps vertical / jambes au-dessus du torse
    vertical_body = closeness_to(90, f["body_tilt"], 18)
    anti_handstand = clamp01(
        1.0
        - 0.75 * vertical_body
        - 0.25 * f["score_legs_above_torso"]
    )

    # Gates plus doux que la version précédente
    structure_gate = clamp01(0.35 + 0.65 * safe_mean(support_column, stacked_order))
    horizontal_gate = clamp01(0.40 + 0.60 * horizontal)

    return clamp01(
        view_gate
        * base
        * anti_lever
        * anti_ground
        * anti_lsit
        * anti_handstand
        * structure_gate
        * horizontal_gate
    )