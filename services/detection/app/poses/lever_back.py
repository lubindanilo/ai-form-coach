from __future__ import annotations
from typing import Dict, List

from ..pose_features import P, clamp01, front_vs_back_hint
from .lever_front import _lever_core

def score(lms: List[P], f: Dict[str, float]) -> float:
    view_gate = clamp01(0.40 + 0.60 * f["profile_score"])
    lever = _lever_core(f)

    hint = front_vs_back_hint(lms)
    backness = clamp01(0.50 - 0.45 * hint)
    back_gate = clamp01(0.35 + 0.65 * backness)

    return clamp01(view_gate * lever * back_gate)