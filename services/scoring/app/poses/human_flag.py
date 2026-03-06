from __future__ import annotations
from typing import Dict, List
from ..pose_features import P, clamp01, closeness_to, safe_mean, hips_open_score

def score(lms: List[P], f: Dict[str, float]) -> float:
    view_gate = clamp01(0.35 + 0.65 * f["profile_score"])

    wrists_stacked = clamp01((f["wrist_dy"] - 0.18) / 0.25) * clamp01(1.0 - f["wrist_dx"] / 0.12)
    horizontal = closeness_to(0, f["body_tilt"], 15)
    arms_vertical = closeness_to(90, f["arms_tilt"], 20)
    hips_open = hips_open_score(f)

    stacked_order_a = safe_mean(f["score_lw_above_ls"], f["score_rw_below_rs"])
    stacked_order_b = safe_mean(f["score_rw_above_rs"], f["score_lw_below_ls"])
    stacked_order = max(stacked_order_a, stacked_order_b)

    knees = safe_mean(closeness_to(180, f["knee_l"], 25), closeness_to(180, f["knee_r"], 25))
    elbows = safe_mean(closeness_to(180, f["elbow_l"], 35), closeness_to(180, f["elbow_r"], 35))

    return clamp01(
        view_gate
        * (
            0.30 * wrists_stacked
            + 0.18 * horizontal
            + 0.15 * arms_vertical
            + 0.15 * stacked_order
            + 0.10 * hips_open
            + 0.07 * elbows
            + 0.05 * knees
        )
    )
