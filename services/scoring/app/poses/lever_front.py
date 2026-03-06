from __future__ import annotations
from typing import Dict, List
from ..pose_features import P, clamp01, closeness_to, safe_mean, hips_open_score, front_vs_back_hint

def _lever_generic(f: Dict[str, float]) -> float:
    horizontal = closeness_to(0, f["body_tilt"], 15)
    hands_above = f["score_hands_above_shoulders"]
    arms_vertical = closeness_to(90, f["arms_tilt"], 22)
    hips_open = hips_open_score(f)
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
    return clamp01(base * anti_ground)

def score(lms: List[P], f: Dict[str, float]) -> float:
    view_gate = clamp01(0.35 + 0.65 * f["profile_score"])
    lever = _lever_generic(f)
    hint = front_vs_back_hint(lms)
    front_boost = clamp01(0.5 + 0.25 * hint)
    return clamp01(view_gate * lever * front_boost)
