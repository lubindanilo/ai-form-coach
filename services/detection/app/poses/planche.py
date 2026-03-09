from __future__ import annotations
from typing import Dict, List

from ..pose_features import (
    P, clamp01, closeness_to, in_range, safe_mean,
    hips_open_score, hips_flexed_strict
)

def score(lms: List[P], f: Dict[str, float]) -> float:
    view_gate = clamp01(0.40 + 0.60 * f["profile_score"])

    hands_below = f["score_hands_below_shoulders"]
    hands_above = f["score_hands_above_shoulders"]

    horizontal = closeness_to(0, f["body_tilt"], 15)
    torso_horizontal = closeness_to(0, f["torso_tilt"], 18)
    legs_horizontal = closeness_to(0, f["legs_tilt"], 18)
    segments_horizontal = safe_mean(torso_horizontal, legs_horizontal)

    elbows_straight = safe_mean(
        closeness_to(180, f["elbow_l"], 25),
        closeness_to(180, f["elbow_r"], 25),
    )
    elbow_bent = safe_mean(
        in_range(f["elbow_l"], 70, 120, 20),
        in_range(f["elbow_r"], 70, 120, 20),
    )

    hips_open = hips_open_score(f)
    hips_flexed = hips_flexed_strict(f)

    knees = safe_mean(
        closeness_to(180, f["knee_l"], 25),
        closeness_to(180, f["knee_r"], 25),
    )
    support = in_range(f["d_wrist_sh"], 0.25, 1.10, 0.35)
    hips_far = in_range(f["d_hip_wrist"], 0.75, 2.20, 0.45)

    base = clamp01(
        0.16 * hands_below
        + 0.18 * horizontal
        + 0.12 * segments_horizontal
        + 0.20 * elbows_straight
        + 0.16 * hips_open
        + 0.05 * knees
        + 0.05 * support
        + 0.08 * hips_far
    )

    anti_lsit = clamp01(1.0 - 0.75 * hips_flexed)
    anti_lever = clamp01(1.0 - 0.85 * hands_above)
    anti_elbow = clamp01(1.0 - 0.65 * elbow_bent)

    gate = (
        clamp01(0.35 + 0.65 * hands_below)
        * clamp01(0.35 + 0.65 * elbows_straight)
        * clamp01(0.30 + 0.70 * hips_far)
    )

    return clamp01(view_gate * base * anti_lsit * anti_lever * anti_elbow * gate)