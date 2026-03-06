from __future__ import annotations
from typing import Dict, List

from ..pose_features import (
    P, clamp01, closeness_to, in_range, safe_mean,
    hips_flexed_soft, hips_open_score
)

def score(lms: List[P], f: Dict[str, float]) -> float:
    view_gate = clamp01(0.35 + 0.65 * f["profile_score"])

    torso_vertical = closeness_to(90, f["torso_tilt"], 18)
    legs_horizontal = closeness_to(0, f["legs_tilt"], 18)

    # Discriminant vs planche : le corps est plutôt diagonal en L-sit (pas parfaitement horizontal)
    body_diagonal = in_range(f["body_tilt"], 25, 75, 20)

    hips_flexed = hips_flexed_soft(f)
    hips_close = in_range(f["d_hip_wrist"], 0.10, 0.85, 0.30)

    elbows = safe_mean(closeness_to(180, f["elbow_l"], 30), closeness_to(180, f["elbow_r"], 30))
    sh_above_hip = f["score_shoulders_above_hips"]

    base = clamp01(
        0.20 * torso_vertical
        + 0.12 * legs_horizontal
        + 0.18 * body_diagonal
        + 0.22 * hips_flexed
        + 0.10 * hips_close
        + 0.08 * elbows
        + 0.06 * f["score_hands_below_shoulders"]
        + 0.04 * sh_above_hip
    )

    # anti-planche
    planche_like = safe_mean(closeness_to(0, f["body_tilt"], 15), hips_open_score(f))
    anti_planche = clamp01(1.0 - 0.70 * planche_like)

    gate = clamp01(0.15 + 0.85 * torso_vertical) * clamp01(0.25 + 0.75 * body_diagonal)
    return clamp01(view_gate * base * gate * anti_planche)