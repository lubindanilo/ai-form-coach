# services/scoring/app/dataset.py
from __future__ import annotations

import csv
import os
import time
import uuid
from typing import Dict, List, Optional

from .pose_rules import P


def _ensure_parent_dir(path: str) -> None:
    parent = os.path.dirname(path)
    if parent:
        os.makedirs(parent, exist_ok=True)


def flatten_landmarks(lms: List[P]) -> Dict[str, float]:
    row: Dict[str, float] = {}
    for i, p in enumerate(lms):
        row[f"lm_{i:02d}_x"] = float(p.x)
        row[f"lm_{i:02d}_y"] = float(p.y)
        row[f"lm_{i:02d}_z"] = float(p.z)
        row[f"lm_{i:02d}_v"] = float(p.v)
    return row


def append_pose_sample_to_csv(
    csv_path: str,
    landmarks: List[P],
    predicted_pose: str,
    confidence: float,
    user_label: Optional[str] = None,
    meta: Optional[Dict[str, str]] = None,
    extra_features: Optional[Dict[str, float]] = None,
) -> str:
    """
    Appends one sample to a CSV file (creates it with header if needed).
    Returns the generated sample_id.
    """
    _ensure_parent_dir(csv_path)

    sample_id = str(uuid.uuid4())
    created_at = int(time.time())

    row: Dict[str, object] = {
        "sample_id": sample_id,
        "created_at": created_at,
        "predicted_pose": predicted_pose,
        "confidence": float(confidence),
        "user_label": user_label or "",
    }

    if meta:
        for k, v in meta.items():
            row[f"meta_{k}"] = v

    if extra_features:
        for k, v in extra_features.items():
            row[f"feat_{k}"] = float(v)

    row.update(flatten_landmarks(landmarks))

    file_exists = os.path.exists(csv_path)
    with open(csv_path, "a", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=list(row.keys()))
        if not file_exists:
            writer.writeheader()
        writer.writerow(row)

    return sample_id
