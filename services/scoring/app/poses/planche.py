from __future__ import annotations
from typing import Dict, List
from ..pose_features import (
    P, clamp01, closeness_to, in_range, safe_mean,
    hips_open_score, hips_flexed_strict
)

def score(lms: List[P], f: Dict[str, float]) -> float:
    view_gate = clamp01(0.35 + 0.65 * f["profile_score"])  # planche => profil recommandé

    hands_below = f["score_hands_below_shoulders"]
    horizontal = closeness_to(0, f["body_tilt"], 15)
    elbows = safe_mean(closeness_to(180, f["elbow_l"], 25), closeness_to(180, f["elbow_r"], 25))

    torso_horizontal = closeness_to(0, f["torso_tilt"], 18)
    legs_horizontal = closeness_to(0, f["legs_tilt"], 18)
    segments_horizontal = safe_mean(torso_horizontal, legs_horizontal)

    hips_open = hips_open_score(f)
    hips_flexed = hips_flexed_strict(f)

    knees = safe_mean(closeness_to(180, f["knee_l"], 25), closeness_to(180, f["knee_r"], 25))
    support = in_range(f["d_wrist_sh"], 0.3, 1.0, 0.35)

    # discriminant fort vs L-sit: en planche, hanches “loin” des poignets
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
