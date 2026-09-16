from typing import Any, Dict, List, Union
import numpy as np

FEATURE_NAMES = [
    "danceability",
    "energy",
    "loudness",
    "speechiness",
    "acousticness",
    "instrumentalness",
    "liveness",
    "valence",
    "tempo",
]

# Salient weights for calculating acoustic distance
FEATURE_WEIGHTS = np.array([
    1.2,  # danceability
    1.3,  # energy
    0.8,  # loudness
    0.6,  # speechiness
    1.1,  # acousticness
    0.7,  # instrumentalness
    0.5,  # liveness
    1.2,  # valence (mood / musical positiveness)
    1.0,  # tempo
], dtype=np.float32)


def normalize_loudness(loudness: Union[float, None]) -> float:
    """Normalize dB scale (-60 dB to 0 dB) to [0.0, 1.0]."""
    if loudness is None:
        return 0.5
    val = (float(loudness) + 60.0) / 60.0
    return float(np.clip(val, 0.0, 1.0))


def normalize_tempo(tempo: Union[float, None]) -> float:
    """Normalize BPM (50 to 220 BPM) to [0.0, 1.0]."""
    if tempo is None:
        return 0.5
    val = (float(tempo) - 50.0) / (220.0 - 50.0)
    return float(np.clip(val, 0.0, 1.0))


def extract_feature_vector(song: Any, apply_weights: bool = False) -> np.ndarray:
    """
    Extract a normalized 9-dimensional audio feature vector from a Song ORM model or dict.
    """
    def _get(attr: str, default: float = 0.5) -> float:
        if isinstance(song, dict):
            val = song.get(attr)
        else:
            val = getattr(song, attr, None)
        return float(val) if val is not None else default

    vec = np.array([
        _get("danceability"),
        _get("energy"),
        normalize_loudness(_get("loudness", -10.0)),
        _get("speechiness", 0.08),
        _get("acousticness"),
        _get("instrumentalness", 0.0),
        _get("liveness", 0.15),
        _get("valence"),
        normalize_tempo(_get("tempo", 120.0)),
    ], dtype=np.float32)

    if apply_weights:
        vec = vec * FEATURE_WEIGHTS

    return vec
