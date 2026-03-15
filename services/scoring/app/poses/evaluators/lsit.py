from app.scoring.engine import evaluate_dimension
from app.poses.specs.lsit_spec import (
    BODY_LINE_METRICS,
    FIGURE_NAME,
    LOCKOUT_EXTENSION_METRICS,
    SYMMETRY_METRICS,
)


def score_body_line(landmarks):
    return evaluate_dimension(landmarks, BODY_LINE_METRICS)


def score_symmetry(landmarks):
    return evaluate_dimension(landmarks, SYMMETRY_METRICS)


def score_lockout_extension(landmarks):
    return evaluate_dimension(landmarks, LOCKOUT_EXTENSION_METRICS)


def score_all(landmarks):
    return {
        "body_line": score_body_line(landmarks),
        "symmetry": score_symmetry(landmarks),
        "lockout_extension": score_lockout_extension(landmarks),
    }
