import re
from typing import Dict, Any, Tuple
import numpy as np

# Keyword sentiment and acoustic feature mappings
MODIFIERS = {
    # High energy
    "workout": {"energy": 0.4, "tempo": 25.0, "danceability": 0.25, "valence": 0.1},
    "gym": {"energy": 0.45, "tempo": 30.0, "danceability": 0.2},
    "cardio": {"energy": 0.4, "tempo": 35.0, "danceability": 0.3},
    "running": {"energy": 0.35, "tempo": 35.0, "danceability": 0.25},
    "hype": {"energy": 0.4, "danceability": 0.3, "valence": 0.2},
    "heavy": {"energy": 0.45, "loudness": 8.0, "acousticness": -0.4},
    "intense": {"energy": 0.4, "tempo": 20.0},
    "fast": {"tempo": 40.0, "energy": 0.2},

    # Low energy / chill / study
    "chill": {"energy": -0.35, "acousticness": 0.3, "tempo": -25.0, "loudness": -6.0},
    "relax": {"energy": -0.4, "acousticness": 0.35, "tempo": -30.0},
    "calm": {"energy": -0.45, "acousticness": 0.4, "tempo": -30.0, "loudness": -8.0},
    "study": {"energy": -0.4, "acousticness": 0.45, "speechiness": -0.05, "tempo": -20.0},
    "focus": {"energy": -0.35, "acousticness": 0.4, "instrumentalness": 0.3},
    "sleep": {"energy": -0.5, "acousticness": 0.5, "tempo": -40.0, "loudness": -10.0},
    "lofi": {"energy": -0.3, "acousticness": 0.3, "tempo": -30.0, "danceability": 0.1},
    "lo-fi": {"energy": -0.3, "acousticness": 0.3, "tempo": -30.0, "danceability": 0.1},

    # Valence / emotion
    "happy": {"valence": 0.45, "energy": 0.2, "danceability": 0.2},
    "joy": {"valence": 0.45, "energy": 0.2},
    "party": {"danceability": 0.4, "energy": 0.35, "valence": 0.3, "tempo": 15.0},
    "dance": {"danceability": 0.45, "energy": 0.3, "tempo": 10.0},
    "fun": {"valence": 0.35, "danceability": 0.25},
    "sad": {"valence": -0.45, "energy": -0.3, "acousticness": 0.3, "tempo": -20.0},
    "melancholy": {"valence": -0.4, "energy": -0.3, "acousticness": 0.35},
    "rain": {"valence": -0.2, "energy": -0.2, "acousticness": 0.3},
    "rainy": {"valence": -0.2, "energy": -0.2, "acousticness": 0.3},
    "heartbreak": {"valence": -0.45, "energy": -0.2, "acousticness": 0.3},

    # Acoustic / organic
    "acoustic": {"acousticness": 0.55, "energy": -0.2, "loudness": -6.0},
    "piano": {"acousticness": 0.5, "instrumentalness": 0.3, "energy": -0.2},
    "guitar": {"acousticness": 0.4, "energy": -0.1},
    "classical": {"acousticness": 0.6, "instrumentalness": 0.5, "energy": -0.3},
    "jazz": {"acousticness": 0.35, "danceability": 0.1, "valence": 0.1},
    "coffee": {"acousticness": 0.35, "energy": -0.2, "tempo": -15.0},

    # Electronic / Modern
    "electronic": {"acousticness": -0.4, "energy": 0.3, "danceability": 0.3},
    "synth": {"acousticness": -0.4, "energy": 0.25, "danceability": 0.25},
    "synthwave": {"energy": 0.3, "danceability": 0.25, "tempo": 10.0, "acousticness": -0.3},
    "cyberpunk": {"energy": 0.4, "danceability": 0.2, "acousticness": -0.4},
    "techno": {"energy": 0.4, "danceability": 0.35, "tempo": 20.0, "acousticness": -0.45},
    "edm": {"energy": 0.45, "danceability": 0.35, "tempo": 20.0, "valence": 0.2},
}


def parse_prompt_to_vector(prompt: str) -> Tuple[Dict[str, Any], str, str]:
    """
    Parse natural language description into target acoustic feature bounds,
    an AI-styled playlist title, and a descriptive summary.
    """
    cleaned = prompt.lower().strip()
    words = re.findall(r"\b[\w-]+\b", cleaned)

    # Base neutral baseline vector
    base_features = {
        "danceability": 0.55,
        "energy": 0.50,
        "loudness": -10.0,
        "speechiness": 0.07,
        "acousticness": 0.30,
        "instrumentalness": 0.15,
        "liveness": 0.15,
        "valence": 0.50,
        "tempo": 115.0,
    }

    matched_keywords = []

    for word in words:
        if word in MODIFIERS:
            matched_keywords.append(word)
            mods = MODIFIERS[word]
            for key, delta in mods.items():
                base_features[key] += delta

    # Clamp bounded features
    for key in ["danceability", "energy", "speechiness", "acousticness", "instrumentalness", "liveness", "valence"]:
        base_features[key] = float(np.clip(base_features[key], 0.05, 0.98))

    base_features["loudness"] = float(np.clip(base_features["loudness"], -35.0, -2.0))
    base_features["tempo"] = float(np.clip(base_features["tempo"], 60.0, 180.0))

    # Generate title
    if matched_keywords:
        top_words = " & ".join(k.capitalize() for k in matched_keywords[:2])
        title = f"AI Mix: {top_words}"
    else:
        title = f"AI Mix: {prompt.title()[:30]}"

    description = (
        f"Custom acoustic profile generated from prompt '{prompt}' "
        f"(Target Energy: {int(base_features['energy'] * 100)}%, "
        f"Mood: {int(base_features['valence'] * 100)}%, "
        f"Tempo: ~{int(base_features['tempo'])} BPM)"
    )

    return base_features, title, description
