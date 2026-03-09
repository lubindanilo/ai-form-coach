from __future__ import annotations
from typing import Dict, List

from ..pose_features import (
    P, clamp01, closeness_to, in_range, safe_mean,
    hips_open_score, hips_flexed_soft, front_vs_back_hint
)

def _lever_core(f: Dict[str, float]) -> float:
    horizontal = closeness_to(0, f["body_tilt"], 16)
    torso_horizontal = closeness_to(0, f["torso_tilt"], 18)
    legs_horizontal = closeness_to(0, f["legs_tilt"], 18)
    segments_horizontal = safe_mean(torso_horizontal, legs_horizontal)

    hands_above = f["score_hands_above_shoulders"]
    hands_below = f["score_hands_below_shoulders"]
    arms_vertical = closeness_to(90, f["arms_tilt"], 22)

    elbows_straight = safe_mean(
        closeness_to(180, f["elbow_l"], 28),
        closeness_to(180, f["elbow_r"], 28),
    )
    knees_straight = safe_mean(
        closeness_to(180, f["knee_l"], 28),
        closeness_to(180, f["knee_r"], 28),
    )

    hips_open = hips_open_score(f)
    hips_flexed = hips_flexed_soft(f)

    hips_close = in_range(f["d_hip_wrist"], 0.15, 0.75, 0.25)
    support = in_range(f["d_wrist_sh"], 0.30, 1.50, 0.45)

    base = clamp01(
        0.18 * horizontal
        + 0.14 * segments_horizontal
        + 0.18 * hands_above
        + 0.12 * arms_vertical
        + 0.14 * elbows_straight
        + 0.08 * knees_straight
        + 0.10 * hips_open
        + 0.06 * support
    )

    anti_planche = clamp01(1.0 - 0.80 * hands_below)
    anti_elbow = clamp01(1.0 - 0.55 * hips_close)
    anti_lsit = clamp01(1.0 - 0.60 * hips_flexed)

    gate = (
        clamp01(0.30 + 0.70 * hands_above)
        * clamp01(0.30 + 0.70 * horizontal)
        * clamp01(0.35 + 0.65 * elbows_straight)
    )

    return clamp01(base * anti_planche * anti_elbow * anti_lsit * gate)

def score(lms: List[P], f: Dict[str, float]) -> float:
    view_gate = clamp01(0.40 + 0.60 * f["profile_score"])
    lever = _lever_core(f)

    hint = front_vs_back_hint(lms)
    frontness = clamp01(0.50 + 0.45 * hint)
    front_gate = clamp01(0.35 + 0.65 * frontness)

    return clamp01(view_gate * lever * front_gate)