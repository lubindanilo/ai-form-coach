from app.geometry import xy
from app.scoring.base_types import MetricDefinition
from app.scoring.engine import evaluate_dimension
from app.scoring.metrics.symmetry_metrics import (
    score_joint_angle_symmetry,
    score_pair_height_symmetry,
)
from app.poses.specs.human_flag_spec import (
    BODY_LINE_METRICS,
    FIGURE_NAME,
    build_lockout_metrics,
)


HUMAN_FLAG_SYMMETRY_METRICS = [
    MetricDefinition(
        "hip_height_symmetry",
        score_pair_height_symmetry,
        ("LEFT_HIP", "RIGHT_HIP"),
        {
            "left_name": "LEFT_HIP",
            "right_name": "RIGHT_HIP",
            "tolerance_ratio": 0.12,
            "max_ratio": 0.40,
        },
        0.20,
    ),
    MetricDefinition(
        "knee_angle_symmetry",
        score_joint_angle_symmetry,
        (
            "LEFT_HIP",
            "LEFT_KNEE",
            "LEFT_ANKLE",
            "RIGHT_HIP",
            "RIGHT_KNEE",
            "RIGHT_ANKLE",
        ),
        {
            "left_triplet": ("LEFT_HIP", "LEFT_KNEE", "LEFT_ANKLE"),
            "right_triplet": ("RIGHT_HIP", "RIGHT_KNEE", "RIGHT_ANKLE"),
            "tolerance_deg": 14.0,
            "max_error_deg": 55.0,
        },
        0.80,
    ),
]


def _bottom_arm_side(landmarks) -> str:
    _, left_y = xy(landmarks, "LEFT_WRIST")
    _, right_y = xy(landmarks, "RIGHT_WRIST")
    return "LEFT" if left_y > right_y else "RIGHT"


def score_body_line(landmarks):
    return evaluate_dimension(landmarks, BODY_LINE_METRICS)


def score_symmetry(landmarks):
    return evaluate_dimension(landmarks, HUMAN_FLAG_SYMMETRY_METRICS)


def score_lockout_extension(landmarks):
    return evaluate_dimension(landmarks, build_lockout_metrics(_bottom_arm_side(landmarks)))


def score_all(landmarks):
    return {
        "body_line": score_body_line(landmarks),
        "symmetry": score_symmetry(landmarks),
        "lockout_extension": score_lockout_extension(landmarks),
    }
