from app.scoring.base_types import MetricDefinition
from app.scoring.metrics.extension_metrics import score_elbow_lockout, score_knee_lockout
from app.scoring.metrics.line_metrics import score_hip_on_line, score_midline_horizontal
from app.scoring.metrics.symmetry_metrics import (
    score_arm_mirror_symmetry,
    score_leg_axis_parallelism,
    score_leg_stacking_on_axis,
)

FIGURE_NAME = "human_flag"

BODY_LINE_METRICS = [
    MetricDefinition(
        "shoulder_ankle_horizontality",
        score_midline_horizontal,
        ("LEFT_SHOULDER", "RIGHT_SHOULDER", "LEFT_ANKLE", "RIGHT_ANKLE"),
        {
            "start_left": "LEFT_SHOULDER",
            "start_right": "RIGHT_SHOULDER",
            "end_left": "LEFT_ANKLE",
            "end_right": "RIGHT_ANKLE",
            "tolerance_deg": 6.0,
            "max_error_deg": 18.0,
        },
        0.55,
    ),
    MetricDefinition(
        "hip_on_line",
        score_hip_on_line,
        ("LEFT_SHOULDER", "RIGHT_SHOULDER", "LEFT_HIP", "RIGHT_HIP", "LEFT_ANKLE", "RIGHT_ANKLE"),
        {
            "tolerance_ratio": 0.06,
            "max_ratio": 0.20,
        },
        0.45,
    ),
]

SYMMETRY_METRICS = [
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

DEFAULT_LOCKOUT_WEIGHTS = {
    "bottom_arm_lockout": 0.40,
    "top_arm_lockout": 0.30,
    "left_knee_lockout": 0.15,
    "right_knee_lockout": 0.15,
}


def build_lockout_metrics(bottom_side: str) -> list[MetricDefinition]:
    top_side = "RIGHT" if bottom_side == "LEFT" else "LEFT"
    return [
        MetricDefinition(
            "bottom_arm_lockout",
            score_elbow_lockout,
            (f"{bottom_side}_SHOULDER", f"{bottom_side}_ELBOW", f"{bottom_side}_WRIST"),
            {"side": bottom_side},
            DEFAULT_LOCKOUT_WEIGHTS["bottom_arm_lockout"],
            {"bottom_arm_side": bottom_side},
        ),
        MetricDefinition(
            "top_arm_lockout",
            score_elbow_lockout,
            (f"{top_side}_SHOULDER", f"{top_side}_ELBOW", f"{top_side}_WRIST"),
            {"side": top_side},
            DEFAULT_LOCKOUT_WEIGHTS["top_arm_lockout"],
            {"top_arm_side": top_side},
        ),
        MetricDefinition(
            "left_knee_lockout",
            score_knee_lockout,
            ("LEFT_HIP", "LEFT_KNEE", "LEFT_ANKLE"),
            {"side": "LEFT"},
            DEFAULT_LOCKOUT_WEIGHTS["left_knee_lockout"],
        ),
        MetricDefinition(
            "right_knee_lockout",
            score_knee_lockout,
            ("RIGHT_HIP", "RIGHT_KNEE", "RIGHT_ANKLE"),
            {"side": "RIGHT"},
            DEFAULT_LOCKOUT_WEIGHTS["right_knee_lockout"],
        ),
    ]
