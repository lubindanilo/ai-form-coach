from app.geometry import xy
from app.scoring.base_types import MetricDefinition
from app.scoring.engine import evaluate_dimension
from app.scoring.metrics.symmetry_metrics import (
    score_arm_mirror_symmetry,
    score_leg_axis_parallelism,
    score_leg_stacking_on_axis,
)
from app.poses.specs.human_flag_spec import (
    BODY_LINE_METRICS,
    FIGURE_NAME,
    build_lockout_metrics,
)


HUMAN_FLAG_SYMMETRY_METRICS = [
    MetricDefinition(
        "leg_axis_parallelism",
        score_leg_axis_parallelism,
        (
            "LEFT_SHOULDER",
            "RIGHT_SHOULDER",
            "LEFT_HIP",
            "LEFT_ANKLE",
            "RIGHT_HIP",
            "RIGHT_ANKLE",
        ),
        {
            "tolerance_deg": 10.0,
            "max_error_deg": 36.0,
        },
        0.40,
    ),
    MetricDefinition(
        "leg_stacking_on_axis",
        score_leg_stacking_on_axis,
        (
            "LEFT_SHOULDER",
            "RIGHT_SHOULDER",
            "LEFT_HIP",
            "RIGHT_HIP",
            "LEFT_KNEE",
            "RIGHT_KNEE",
            "LEFT_ANKLE",
            "RIGHT_ANKLE",
        ),
        {
            "tolerance_ratio": 0.12,
            "max_ratio": 0.45,
        },
        0.35,
    ),
    MetricDefinition(
        "arm_mirror_symmetry",
        score_arm_mirror_symmetry,
        (
            "LEFT_SHOULDER",
            "LEFT_WRIST",
            "RIGHT_SHOULDER",
            "RIGHT_WRIST",
            "LEFT_ANKLE",
            "RIGHT_ANKLE",
        ),
        {
            "tolerance_deg": 18.0,
            "max_error_deg": 75.0,
            "perpendicular_tolerance_deg": 20.0,
            "perpendicular_max_error_deg": 70.0,
        },
        0.25,
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
