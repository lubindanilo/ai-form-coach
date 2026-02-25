# services/scoring/app/main.py
from __future__ import annotations

import os
from typing import List, Optional, Dict, Any

from fastapi import FastAPI
from pydantic import BaseModel, Field

from .pose_rules import P, classify_pose, POSES
from .dataset import append_pose_sample_to_csv

app = FastAPI()


class LandmarkIn(BaseModel):
    x: float
    y: float
    z: float = 0.0
    visibility: float = Field(0.0, ge=0.0, le=1.0)


class PoseClassifyRequest(BaseModel):
    landmarks: List[LandmarkIn] = Field(..., min_length=33, max_length=33)
    save_sample: bool = False
    user_label: Optional[str] = None  # if user confirms later, can send again
    meta: Optional[Dict[str, str]] = None  # e.g. {"mode":"photo","client":"web"}
    include_debug: bool = True


class PoseClassifyResponse(BaseModel):
    pose: str
    confidence: float
    scores: Optional[Dict[str, float]] = None
    warnings: List[str] = []
    sample_id: Optional[str] = None


@app.get("/health")
def health() -> Dict[str, str]:
    return {"status": "ok"}


@app.post("/pose/classify", response_model=PoseClassifyResponse)
def pose_classify(req: PoseClassifyRequest) -> PoseClassifyResponse:
    lms = [P(x=p.x, y=p.y, z=p.z, v=p.visibility) for p in req.landmarks]

    pose, conf, scores, warnings = classify_pose(lms)

    sample_id = None
    if req.save_sample:
        csv_path = os.getenv("DATASET_CSV_PATH", "data/datasets/pose_samples.csv")
        # store a few extra debug features too (optional)
        extra_features = {
            "best_conf": conf,
        }
        sample_id = append_pose_sample_to_csv(
            csv_path=csv_path,
            landmarks=lms,
            predicted_pose=pose,
            confidence=conf,
            user_label=req.user_label,
            meta=req.meta,
            extra_features=extra_features,
        )

    return PoseClassifyResponse(
        pose=pose,
        confidence=conf,
        scores=scores if req.include_debug else None,
        warnings=warnings,
        sample_id=sample_id,
    )
