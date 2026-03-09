from __future__ import annotations
from typing import Dict, List

from ..pose_features import (
    P, clamp01, closeness_to, in_range, safe_mean,
    hips_flexed_soft
)

def score(lms: List[P], f: Dict[str, float]) -> float:
    view_gate = clamp01(0.35 + 0.65 * max(f["profile_score"], f["frontal_score"]))  # ok face OU profil

    inv = f["score_legs_above_torso"]
    elbows = safe_mean(closeness_to(180, f["elbow_l"], 30), closeness_to(180, f["elbow_r"], 30))
    knees = safe_mean(closeness_to(180, f["knee_l"], 25), closeness_to(180, f["knee_r"], 25))

    vertical_body = closeness_to(90, f["body_tilt"], 18)
    vertical_legs = closeness_to(90, f["legs_tilt"], 18)
    arms_vertical = closeness_to(90, f["arms_tilt"], 20)

    hands_below = f["score_hands_below_shoulders"]
    support_dist = in_range(f["d_hip_wrist"], 0.3, 1.3, 0.4)

    base = clamp01(
        0.26 * inv
        + 0.14 * vertical_body
        + 0.10 * vertical_legs
        + 0.14 * arms_vertical
        + 0.18 * elbows
        + 0.08 * knees
        + 0.06 * hands_below
        + 0.04 * support_dist
    )

    anti_bar = clamp01(1.0 - 0.70 * f["score_hands_above_shoulders"])

    # ---- NOUVEAU : pénalité anti L-Sit ----
    hips_flexed = hips_flexed_soft(f)                    # fort en L-Sit
    legs_horizontal = closeness_to(0, f["legs_tilt"], 18)   # fort en L-Sit
    torso_vertical = closeness_to(90, f["torso_tilt"], 18)  # souvent fort en L-Sit

    l_sit_like = clamp01(
        0.45 * hips_flexed
        + 0.35 * legs_horizontal
        + 0.20 * torso_vertical
    )

    anti_lsit = clamp01(1.0 - 0.85 * l_sit_like)

    # Gating supplémentaire : un vrai handstand a besoin d'un corps vraiment vertical
    vertical_gate = clamp01(0.20 + 0.80 * vertical_body) * clamp01(0.20 + 0.80 * vertical_legs)

    return clamp01(view_gate * base * anti_bar * anti_lsit * vertical_gate)