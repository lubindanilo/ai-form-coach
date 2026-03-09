from __future__ import annotations
from typing import Dict, List

from ..pose_features import (
    P, clamp01, closeness_to, in_range, safe_mean,
    hips_open_score, hips_flexed_soft
)

def score(lms: List[P], f: Dict[str, float]) -> float:
    view_gate = clamp01(0.40 + 0.60 * f["profile_score"])

    horizontal = closeness_to(0, f["body_tilt"], 18)
    torso_horizontal = closeness_to(0, f["torso_tilt"], 20)
    legs_horizontal = closeness_to(0, f["legs_tilt"], 20)
    segments_horizontal = safe_mean(torso_horizontal, legs_horizontal)

    elbow_bent = safe_mean(
        in_range(f["elbow_l"], 70, 120, 20),
        in_range(f["elbow_r"], 70, 120, 20),
    )
    elbows_straight = safe_mean(
        closeness_to(180, f["elbow_l"], 25),
        closeness_to(180, f["elbow_r"], 25),
    )

    hands_below = f["score_hands_below_shoulders"]
    hands_above = f["score_hands_above_shoulders"]

    hips_close = in_range(f["d_hip_wrist"], 0.12, 0.75, 0.28)
    hips_far = in_range(f["d_hip_wrist"], 0.85, 2.10, 0.40)

    hips_open = hips_open_score(f)
    hips_flexed = hips_flexed_soft(f)

    knees = safe_mean(
        closeness_to(180, f["knee_l"], 35),
        closeness_to(180, f["knee_r"], 35),
    )

    base = clamp01(
        0.18 * horizontal
        + 0.10 * segments_horizontal
        + 0.26 * elbow_bent
        + 0.18 * hips_close
        + 0.12 * hands_below
        + 0.08 * hips_open
        + 0.08 * knees
    )

    anti_planche = clamp01(1.0 - 0.65 * elbows_straight)
    anti_planche2 = clamp01(1.0 - 0.55 * hips_far)
    anti_lever = clamp01(1.0 - 0.80 * hands_above)
    anti_lsit = clamp01(1.0 - 0.45 * hips_flexed)

    gate = (
        clamp01(0.30 + 0.70 * elbow_bent)
        * clamp01(0.35 + 0.65 * hands_below)
        * clamp01(0.35 + 0.65 * hips_close)
    )

    return clamp01(view_gate * base * anti_planche * anti_planche2 * anti_lever * anti_lsit * gate)