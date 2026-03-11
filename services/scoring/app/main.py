from fastapi import FastAPI, HTTPException

from app.pipeline import score_technique
from app.schemas import TechniqueScoreRequest, TechniqueScoreResponse

app = FastAPI(
    title="AI Form Coach - Scoring Service",
    version="0.1.0",
)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/score-technique", response_model=TechniqueScoreResponse)
def score_technique_route(request: TechniqueScoreRequest) -> TechniqueScoreResponse:
    try:
        return score_technique(request.figure, request.landmarks)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Scoring error: {exc}") from exc
