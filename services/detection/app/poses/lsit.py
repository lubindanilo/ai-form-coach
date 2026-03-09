from __future__ import annotations
from typing import Dict, List

from ..pose_features import (
    P, clamp01, closeness_to, in_range, safe_mean,
    hips_flexed_soft, hips_open_score
)

def score(lms: List[P], f: Dict[str, float]) -> float:
    view_gate = clamp01(0.45 + 0.55 * f["profile_score"])

    # Tolérances un peu plus larges
    torso_vertical = closeness_to(90, f["torso_tilt"], 22)
    legs_horizontal = closeness_to(0, f["legs_tilt"], 22)

    # Moins strict : un L-Sit n'est pas toujours fortement "diagonal"
    body_diagonal = in_range(f["body_tilt"], 20, 80, 25)

    hips_flexed = hips_flexed_soft(f)
    hips_close = in_range(f["d_hip_wrist"], 0.10, 0.95, 0.35)

    elbows = safe_mean(
        closeness_to(180, f["elbow_l"], 30),
        closeness_to(180, f["elbow_r"], 30)
    )
    sh_above_hip = f["score_shoulders_above_hips"]
    hands_below = f["score_hands_below_shoulders"]

    # On renforce les critères vraiment distinctifs du L-Sit
    base = clamp01(
        0.24 * torso_vertical
        + 0.20 * legs_horizontal
        + 0.10 * body_diagonal
        + 0.24 * hips_flexed
        + 0.10 * hips_close
        + 0.06 * elbows
        + 0.04 * hands_below
        + 0.02 * sh_above_hip
    )

    # anti-planche : on garde, mais un peu moins agressif
    planche_like = safe_mean(
        closeness_to(0, f["body_tilt"], 15),
        hips_open_score(f)
    )
    anti_planche = clamp01(1.0 - 0.50 * planche_like)

    # Gate moins punitif
    gate = (
        clamp01(0.35 + 0.65 * torso_vertical) *
        clamp01(0.40 + 0.60 * legs_horizontal)
    )

    return clamp01(view_gate * base * gate * anti_planche)