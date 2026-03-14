import math
from typing import Any

from app.geometry import angle_from_names, body_scale, midpoint, xy


def _clamp_score(value: float) -> float:
    return round(max(0.0, min(100.0, value)), 2)


def _linear_score_from_error(error: float, tolerance: float, max_error: float) -> float:
    if error <= tolerance:
        return 100.0
    if error >= max_error:
        return 0.0
    ratio = (error - tolerance) / (max_error - tolerance)
    return _clamp_score(100.0 * (1.0 - ratio))


def _unit_vector(a: tuple[float, float], b: tuple[float, float]) -> tuple[float, float]:
    dx = b[0] - a[0]
    dy = b[1] - a[1]
    norm = math.hypot(dx, dy)
    if norm <= 1e-9:
        return (1.0, 0.0)
    return (dx / norm, dy / norm)


def _body_axis_frame(
    landmarks: list[Any],
) -> tuple[tuple[float, float], tuple[float, float], tuple[float, float]]:
    """
    Repère du corps pour le Human Flag :
    - origin : midpoint des épaules
    - u : axe longitudinal du corps
    - n : axe normal au corps
    """
    shoulders_mid = midpoint(landmarks, "LEFT_SHOULDER", "RIGHT_SHOULDER")
    ankles_mid = midpoint(landmarks, "LEFT_ANKLE", "RIGHT_ANKLE")
    u = _unit_vector(shoulders_mid, ankles_mid)
    n = (-u[1], u[0])
    return shoulders_mid, u, n


def _signed_distance_to_axis(
    point: tuple[float, float],
    origin: tuple[float, float],
    normal: tuple[float, float],
) -> float:
    px = point[0] - origin[0]
    py = point[1] - origin[1]
    return px * normal[0] + py * normal[1]


def _signed_angle_deg_from_axis(
    axis_unit: tuple[float, float],
    start: tuple[float, float],
    end: tuple[float, float],
) -> float:
    vec = _unit_vector(start, end)
    dot = max(-1.0, min(1.0, axis_unit[0] * vec[0] + axis_unit[1] * vec[1]))
    det = axis_unit[0] * vec[1] - axis_unit[1] * vec[0]
    return math.degrees(math.atan2(det, dot))


def _unsigned_angle_between_deg(
    u: tuple[float, float],
    v: tuple[float, float],
) -> float:
    dot = max(-1.0, min(1.0, u[0] * v[0] + u[1] * v[1]))
    angle = math.degrees(math.acos(dot))
    return min(angle, abs(180.0 - angle))


def score_pair_height_symmetry(
    landmarks: list[Any],
    left_name: str,
    right_name: str,
    tolerance_ratio: float = 0.04,
    max_ratio: float = 0.22,
) -> float:
    _, y_left = xy(landmarks, left_name)
    _, y_right = xy(landmarks, right_name)
    ratio = abs(y_left - y_right) / body_scale(landmarks)
    return _linear_score_from_error(ratio, tolerance=tolerance_ratio, max_error=max_ratio)


def score_joint_angle_symmetry(
    landmarks: list[Any],
    left_triplet: tuple[str, str, str],
    right_triplet: tuple[str, str, str],
    tolerance_deg: float = 8.0,
    max_error_deg: float = 40.0,
) -> float:
    left_angle = angle_from_names(landmarks, *left_triplet)
    right_angle = angle_from_names(landmarks, *right_triplet)
    return _linear_score_from_error(abs(left_angle - right_angle), tolerance=tolerance_deg, max_error=max_error_deg)


def score_leg_axis_parallelism(
    landmarks: list[Any],
    tolerance_deg: float = 10.0,
    max_error_deg: float = 36.0,
) -> float:
    """
    Les deux jambes doivent être parallèles à l’axe longitudinal du corps.
    On compare l’axe du corps à :
    - hanche gauche -> cheville gauche
    - hanche droite -> cheville droite
    """
    shoulders_mid = midpoint(landmarks, "LEFT_SHOULDER", "RIGHT_SHOULDER")
    ankles_mid = midpoint(landmarks, "LEFT_ANKLE", "RIGHT_ANKLE")
    body_axis = _unit_vector(shoulders_mid, ankles_mid)

    left_leg = _unit_vector(xy(landmarks, "LEFT_HIP"), xy(landmarks, "LEFT_ANKLE"))
    right_leg = _unit_vector(xy(landmarks, "RIGHT_HIP"), xy(landmarks, "RIGHT_ANKLE"))

    left_error = _unsigned_angle_between_deg(body_axis, left_leg)
    right_error = _unsigned_angle_between_deg(body_axis, right_leg)
    mean_error = (left_error + right_error) / 2.0

    return _linear_score_from_error(mean_error, tolerance=tolerance_deg, max_error=max_error_deg)


def score_leg_stacking_on_axis(
    landmarks: list[Any],
    tolerance_ratio: float = 0.12,
    max_ratio: float = 0.45,
) -> float:
    """
    On projette hanches, genoux et chevilles sur l’axe normal au corps.
    Si les deux jambes sont bien "stacked" autour de l’axe du corps,
    la distance gauche/droite sur cet axe doit rester faible.
    """
    origin, _, normal = _body_axis_frame(landmarks)

    pairs = [
        ("LEFT_HIP", "RIGHT_HIP"),
        ("LEFT_KNEE", "RIGHT_KNEE"),
        ("LEFT_ANKLE", "RIGHT_ANKLE"),
    ]

    spreads = []
    for left_name, right_name in pairs:
        left_point = xy(landmarks, left_name)
        right_point = xy(landmarks, right_name)

        d_left = _signed_distance_to_axis(left_point, origin, normal)
        d_right = _signed_distance_to_axis(right_point, origin, normal)

        spreads.append(abs(d_left - d_right))

    mean_spread = sum(spreads) / len(spreads)
    ratio = mean_spread / body_scale(landmarks)
    return _linear_score_from_error(ratio, tolerance=tolerance_ratio, max_error=max_ratio)


def score_arm_mirror_symmetry(
    landmarks: list[Any],
    tolerance_deg: float = 18.0,
    max_error_deg: float = 75.0,
    perpendicular_tolerance_deg: float = 20.0,
    perpendicular_max_error_deg: float = 70.0,
) -> float:
    """
    Compare les deux bras dans le repère du corps :
    - symétrie miroir autour de l’axe longitudinal
    - proximité de la perpendicularité par rapport à cet axe
    """
    _, body_axis, _ = _body_axis_frame(landmarks)

    left_angle = _signed_angle_deg_from_axis(
        body_axis,
        xy(landmarks, "LEFT_SHOULDER"),
        xy(landmarks, "LEFT_WRIST"),
    )
    right_angle = _signed_angle_deg_from_axis(
        body_axis,
        xy(landmarks, "RIGHT_SHOULDER"),
        xy(landmarks, "RIGHT_WRIST"),
    )

    mirror_error = abs(abs(left_angle) - abs(right_angle))
    mirror_score = _linear_score_from_error(
        mirror_error,
        tolerance=tolerance_deg,
        max_error=max_error_deg,
    )

    perp_error = (
        abs(abs(left_angle) - 90.0) + abs(abs(right_angle) - 90.0)
    ) / 2.0
    perpendicular_score = _linear_score_from_error(
        perp_error,
        tolerance=perpendicular_tolerance_deg,
        max_error=perpendicular_max_error_deg,
    )

    return _clamp_score(0.7 * mirror_score + 0.3 * perpendicular_score)
