from app.figures import (
    back_lever,
    elbow_lever,
    front_lever,
    handstand,
    human_flag,
    lsit,
    planche,
)

FIGURE_REGISTRY = {
    "planche": planche,
    "lsit": lsit,
    "l_sit": lsit,
    "front_lever": front_lever,
    "back_lever": back_lever,
    "handstand": handstand,
    "human_flag": human_flag,
    "elbow_lever": elbow_lever,
}


def normalize_figure_name(name: str) -> str:
    cleaned = name.strip().lower().replace(" ", "_").replace("-", "_")
    aliases = {
        "l_sit": "lsit",
        "full_planche": "planche",
    }
    return aliases.get(cleaned, cleaned)


def get_figure_module(name: str):
    normalized = normalize_figure_name(name)
    if normalized not in FIGURE_REGISTRY:
        supported = ", ".join(sorted(FIGURE_REGISTRY.keys()))
        raise ValueError(f"Unsupported figure '{name}'. Supported figures: {supported}")
    return FIGURE_REGISTRY[normalized]
