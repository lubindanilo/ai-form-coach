from __future__ import annotations
from typing import Dict, List, Tuple

from .pose_features import P, compute_features
from .pose_logging import maybe_log_debug

from .poses.planche import score as score_planche
from .poses.lsit import score as score_lsit
from .poses.handstand import score as score_handstand
from .poses.elbow_lever import score as score_elbow
from .poses.human_flag import score as score_flag
from .poses.lever_front import score as score_front
from .poses.lever_back import score as score_back


POSES = [
    "Full Planche",
    "L-Sit",
    "Front Lever",
    "Human Flag",
    "Handstand",
    "Elbow lever",
    "Back Lever",
]


def classify_pose(lms: List[P], min_visibility: float = 0.4) -> Tuple[str, float, Dict[str, float], List[str]]:
    warnings: List[str] = []
    f = compute_features(lms, min_visibility=min_visibility, warnings=warnings)

    # warning cadrage: pour ces figures, profil est + fiable
    if f["profile_score"] < 0.35:
        warnings.append(
            "Angle caméra: essaie plutôt un profil net (de côté). Pour Planche/L-Sit/Levers/Elbow lever/Human flag, le profil est beaucoup plus fiable."
        )

    scores: Dict[str, float] = {
        "Full Planche": score_planche(lms, f),
        "L-Sit": score_lsit(lms, f),
        "Front Lever": score_front(lms, f),
        "Back Lever": score_back(lms, f),
        "Human Flag": score_flag(lms, f),
        "Handstand": score_handstand(lms, f),
        "Elbow lever": score_elbow(lms, f),
    }

    best_pose = max(scores.items(), key=lambda kv: kv[1])[0]
    best_conf = float(scores[best_pose])

    maybe_log_debug(best_pose, best_conf, scores, f)

    if best_conf < 0.55:
        warnings.append(
            f"J'ai une Low confidence ({best_conf:.2f}). Consider better framing: full body, good light, camera straight."
        )

    return best_pose, best_conf, scores, warnings
