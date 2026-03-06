from __future__ import annotations
from typing import Dict, List
from ..pose_features import (
    P, clamp01, closeness_to, in_range, safe_mean,
    hips_open_score, hips_flexed_soft
)

def score(lms: List[P], f: Dict[str, float]) -> float:
    view_gate = clamp01(0.35 + 0.65 * f["profile_score"])

    horizontal = closeness_to(0, f["body_tilt"], 18)
    elbow_bent = safe_mean(in_range(f["elbow_l"], 70, 120, 20), in_range(f["elbow_r"], 70, 120, 20))
    elbows_straight = safe_mean(closeness_to(180, f["elbow_l"], 25), closeness_to(180, f["elbow_r"], 25))

    hips_close = in_range(f["d_hip_wrist"], 0.15, 0.70, 0.25)
    hips_open = hips_open_score(f)
    hips_flexed = hips_flexed_soft(f)

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
