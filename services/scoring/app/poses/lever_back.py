from __future__ import annotations
from typing import Dict, List
from ..pose_features import P, clamp01, front_vs_back_hint
from .lever_front import _lever_generic  # reuse

def score(lms: List[P], f: Dict[str, float]) -> float:
    view_gate = clamp01(0.35 + 0.65 * f["profile_score"])
    lever = _lever_generic(f)
    hint = front_vs_back_hint(lms)
    back_boost = clamp01(0.5 - 0.25 * hint)
    return clamp01(view_gate * lever * back_boost)
