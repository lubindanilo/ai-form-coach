from __future__ import annotations

import json
import logging
import os
from typing import Dict

logger = logging.getLogger("pose_rules")


def maybe_log_debug(best_pose: str, best_conf: float, scores: Dict[str, float], f: Dict[str, float]) -> None:
    """
    Log en JSON:
    - si POSE_DEBUG=1
    - ou si best_conf < 0.65
    """
    if os.getenv("POSE_DEBUG", "0") != "1" and best_conf >= 0.65:
        return

    payload = {
        "best_pose": best_pose,
        "best_conf": round(best_conf, 3),
        "scores": {k: round(v, 3) for k, v in scores.items()},
        "view": {
            "profile_score": round(f.get("profile_score", 0.0), 3),
            "frontal_score": round(f.get("frontal_score", 0.0), 3),
            "width_ratio": round(f.get("width_ratio", 0.0), 3),
        },
        "key": {
            "body_tilt": round(f.get("body_tilt", 0.0), 2),
            "torso_tilt": round(f.get("torso_tilt", 0.0), 2),
            "legs_tilt": round(f.get("legs_tilt", 0.0), 2),
            "hip_l_ang": round(f.get("hip_l_ang", 0.0), 1),
            "hip_r_ang": round(f.get("hip_r_ang", 0.0), 1),
            "hip_l2_ang": round(f.get("hip_l2_ang", 0.0), 1),
            "hip_r2_ang": round(f.get("hip_r2_ang", 0.0), 1),
            "d_hip_wrist": round(f.get("d_hip_wrist", 0.0), 3),
            "d_wrist_sh": round(f.get("d_wrist_sh", 0.0), 3),
        },
    }

    logger.info("POSE_DEBUG %s", json.dumps(payload))