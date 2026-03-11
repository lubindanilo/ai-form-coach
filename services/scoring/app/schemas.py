from typing import Any

from pydantic import BaseModel, Field


class Landmark(BaseModel):
    x: float
    y: float
    z: float | None = None
    visibility: float | None = None
    presence: float | None = None


class TechniqueScoreRequest(BaseModel):
    figure: str
    landmarks: list[Landmark]


class MetricScore(BaseModel):
    name: str
    score: float
    confidence: float
    meta: dict[str, Any] = Field(default_factory=dict)


class DimensionScore(BaseModel):
    score: float
    confidence: float
    metrics: list[MetricScore] = Field(default_factory=list)


class TechniqueScoreResponse(BaseModel):
    figure: str
    scores: dict[str, float]
    confidence: dict[str, float]
    dimensions: dict[str, DimensionScore]
