import logging
from typing import Dict, List, Any, Optional, Union
import numpy as np
from sklearn.metrics.pairwise import cosine_similarity
from sqlalchemy.orm import Session

from app.models.song import Song
from app.models.user import User
from app.models.interaction import LikedSong, ListeningHistory
from app.recommender.features import extract_feature_vector, FEATURE_NAMES

logger = logging.getLogger("app.recommender")

# Predefined mood targets and descriptors
MOOD_PRESETS: Dict[str, Dict[str, Any]] = {
    "workout": {
        "name": "Workout / High Energy",
        "description": "High-intensity, fast tempo, and driving energy for gym workouts, cardio, and running.",
        "target": {
            "danceability": 0.85,
            "energy": 0.92,
            "loudness": -5.0,
            "speechiness": 0.10,
            "acousticness": 0.05,
            "instrumentalness": 0.10,
            "liveness": 0.20,
            "valence": 0.75,
            "tempo": 135.0,
        },
    },
    "study": {
        "name": "Focus / Study",
        "description": "Calm acoustic textures, low tempo, and minimal vocals for uninterrupted concentration.",
        "target": {
            "danceability": 0.25,
            "energy": 0.20,
            "loudness": -18.0,
            "speechiness": 0.04,
            "acousticness": 0.88,
            "instrumentalness": 0.65,
            "liveness": 0.10,
            "valence": 0.30,
            "tempo": 80.0,
        },
    },
    "chill": {
        "name": "Chill / Late Night",
        "description": "Mellow vibes, warm basslines, and relaxed grooves for unwinding after hours.",
        "target": {
            "danceability": 0.60,
            "energy": 0.45,
            "loudness": -12.0,
            "speechiness": 0.06,
            "acousticness": 0.50,
            "instrumentalness": 0.20,
            "liveness": 0.12,
            "valence": 0.50,
            "tempo": 95.0,
        },
    },
    "party": {
        "name": "Party / Upbeat",
        "description": "Electrifying dance tracks, punchy beats, and vibrant party vibes.",
        "target": {
            "danceability": 0.90,
            "energy": 0.88,
            "loudness": -4.5,
            "speechiness": 0.12,
            "acousticness": 0.05,
            "instrumentalness": 0.15,
            "liveness": 0.25,
            "valence": 0.82,
            "tempo": 126.0,
        },
    },
    "happy": {
        "name": "Happy / Euphoric",
        "description": "Sunny, joyful melodies and high musical positiveness to brighten your mood.",
        "target": {
            "danceability": 0.78,
            "energy": 0.75,
            "loudness": -6.0,
            "speechiness": 0.06,
            "acousticness": 0.25,
            "instrumentalness": 0.05,
            "liveness": 0.18,
            "valence": 0.92,
            "tempo": 120.0,
        },
    },
    "melancholy": {
        "name": "Melancholy / Reflective",
        "description": "Introspective, poignant melodies and deep emotive resonance.",
        "target": {
            "danceability": 0.30,
            "energy": 0.25,
            "loudness": -16.0,
            "speechiness": 0.04,
            "acousticness": 0.75,
            "instrumentalness": 0.30,
            "liveness": 0.10,
            "valence": 0.15,
            "tempo": 72.0,
        },
    },
}


def _format_song_dict(song: Song, score: float, explanation: str) -> Dict[str, Any]:
    return {
        "id": song.id,
        "spotify_id": song.spotify_id,
        "title": song.title,
        "artist": song.artist,
        "album": song.album,
        "preview_url": song.preview_url,
        "image_url": song.image_url,
        "youtube_id": song.youtube_id,
        "duration_ms": song.duration_ms,
        "danceability": song.danceability,
        "energy": song.energy,
        "tempo": song.tempo,
        "valence": song.valence,
        "acousticness": song.acousticness,
        "similarity_score": round(score, 1),
        "explanation": explanation,
    }


def _generate_similarity_explanation(
    target_song: Song, candidate: Song, score: float
) -> str:
    """Generate human-readable explanation for track-to-track recommendation."""
    reasons = []
    # Check energy
    if target_song.energy is not None and candidate.energy is not None:
        if abs(target_song.energy - candidate.energy) < 0.15:
            reasons.append("similar energy level")
    # Check danceability
    if target_song.danceability is not None and candidate.danceability is not None:
        if abs(target_song.danceability - candidate.danceability) < 0.15:
            reasons.append("matching rhythm")
    # Check tempo
    if target_song.tempo is not None and candidate.tempo is not None:
        if abs(target_song.tempo - candidate.tempo) < 15.0:
            reasons.append(f"close tempo (~{int(candidate.tempo)} BPM)")
    # Check acousticness
    if target_song.acousticness is not None and candidate.acousticness is not None:
        if abs(target_song.acousticness - candidate.acousticness) < 0.2:
            reasons.append("similar acoustic character")

    reason_text = ", ".join(reasons[:2]) if reasons else "close overall acoustic profile"
    return f"{round(score, 1)}% match based on {reason_text} with '{target_song.title}'"


class RecommendationEngine:
    """
    Multi-strategy recommendation engine implementing:
    1. Content-based cosine similarity (track-to-track)
    2. User taste vector profiling (history & likes)
    3. Mood & activity-based acoustic filtering
    """

    def get_similar_tracks(
        self,
        song_identifier: Union[int, str],
        limit: int = 10,
        db: Optional[Session] = None,
    ) -> List[Dict[str, Any]]:
        """
        Recommend songs acoustically similar to a seed song using cosine similarity.
        song_identifier can be internal DB id (int) or spotify_id (str).
        """
        if db is None:
            return []

        # Find target song
        target_song = None
        if isinstance(song_identifier, int) or (
            isinstance(song_identifier, str) and song_identifier.isdigit()
        ):
            target_song = db.query(Song).filter(Song.id == int(song_identifier)).first()
        if not target_song:
            target_song = db.query(Song).filter(Song.spotify_id == str(song_identifier)).first()

        if not target_song:
            logger.warning(f"Seed song '{song_identifier}' not found in database.")
            return []

        target_vec = extract_feature_vector(target_song, apply_weights=True).reshape(1, -1)

        # Retrieve all candidate tracks in DB
        candidates: List[Song] = db.query(Song).filter(Song.id != target_song.id).all()
        if not candidates:
            return []

        candidate_matrix = np.array(
            [extract_feature_vector(c, apply_weights=True) for c in candidates],
            dtype=np.float32,
        )

        # Compute cosine similarity
        similarities = cosine_similarity(target_vec, candidate_matrix)[0]

        # Rank candidates
        top_indices = np.argsort(-similarities)[:limit]

        results = []
        for idx in top_indices:
            score = float(similarities[idx]) * 100.0
            candidate = candidates[idx]
            explanation = _generate_similarity_explanation(target_song, candidate, score)
            results.append(_format_song_dict(candidate, score, explanation))

        return results

    def get_user_recommendations(
        self,
        user_id: int,
        limit: int = 10,
        db: Optional[Session] = None,
    ) -> List[Dict[str, Any]]:
        """
        Personalized recommendations computed from a dynamic taste vector
        combining user likes and listening history.
        """
        if db is None:
            return []

        # 1. Fetch user likes
        likes = db.query(LikedSong).filter(LikedSong.user_id == user_id).all()
        # 2. Fetch user listening history
        history = (
            db.query(ListeningHistory)
            .filter(ListeningHistory.user_id == user_id)
            .order_by(ListeningHistory.played_at.desc())
            .limit(50)
            .all()
        )

        liked_song_ids = {l.song_id for l in likes}
        listened_song_ids = {h.song_id for h in history}
        known_song_ids = liked_song_ids.union(listened_song_ids)

        # 3. Handle Cold Start: User has no history/likes yet
        if not known_song_ids:
            # Fallback to diverse top tracks across database
            fallback_songs = db.query(Song).order_by(Song.id.asc()).limit(limit).all()
            return [
                _format_song_dict(
                    s,
                    90.0 - (i * 2.0),
                    "Recommended starter track to discover your musical preferences",
                )
                for i, s in enumerate(fallback_songs)
            ]

        # 4. Build Weighted User Taste Vector
        vectors = []
        weights = []

        # Weight liked tracks heavily (+2.0)
        for like in likes:
            if like.song:
                v = extract_feature_vector(like.song, apply_weights=True)
                vectors.append(v)
                weights.append(like.rating * 2.0)

        # Weight history: completed = +1.0, skipped = -0.5
        for h in history:
            if h.song:
                v = extract_feature_vector(h.song, apply_weights=True)
                vectors.append(v)
                w = -0.5 if h.skipped else (1.2 if h.completed else 0.5)
                weights.append(w)

        if not vectors:
            fallback_songs = db.query(Song).limit(limit).all()
            return [
                _format_song_dict(s, 85.0, "Recommended starter track")
                for s in fallback_songs
            ]

        # Calculate weighted average taste vector
        weights_arr = np.array(weights, dtype=np.float32)
        total_weight = np.sum(np.abs(weights_arr))
        if total_weight == 0:
            total_weight = 1.0

        user_taste_vec = np.sum(
            np.array(vectors) * weights_arr[:, np.newaxis], axis=0
        ) / total_weight
        user_taste_vec = user_taste_vec.reshape(1, -1)

        # 5. Score candidate songs not yet liked
        candidates = db.query(Song).filter(~Song.id.in_(liked_song_ids)).all()
        if not candidates:
            # If user liked everything, allow any song
            candidates = db.query(Song).all()

        if not candidates:
            return []

        candidate_matrix = np.array(
            [extract_feature_vector(c, apply_weights=True) for c in candidates],
            dtype=np.float32,
        )

        similarities = cosine_similarity(user_taste_vec, candidate_matrix)[0]
        top_indices = np.argsort(-similarities)[:limit]

        results = []
        for idx in top_indices:
            score = float(similarities[idx]) * 100.0
            candidate = candidates[idx]
            explanation = f"{round(score, 1)}% match for your personalized listening taste profile"
            results.append(_format_song_dict(candidate, score, explanation))

        return results

    def get_mood_recommendations(
        self,
        mood: str,
        limit: int = 10,
        db: Optional[Session] = None,
    ) -> List[Dict[str, Any]]:
        """
        Recommend songs that align with a specific emotional mood or activity preset.
        """
        if db is None:
            return []

        mood_key = mood.strip().lower()
        preset = MOOD_PRESETS.get(mood_key)
        if not preset:
            available = ", ".join(MOOD_PRESETS.keys())
            raise ValueError(
                f"Unknown mood '{mood}'. Supported moods: {available}"
            )

        target_dict = preset["target"]
        target_vec = extract_feature_vector(target_dict, apply_weights=True).reshape(1, -1)

        candidates = db.query(Song).all()
        if not candidates:
            return []

        candidate_matrix = np.array(
            [extract_feature_vector(c, apply_weights=True) for c in candidates],
            dtype=np.float32,
        )

        similarities = cosine_similarity(target_vec, candidate_matrix)[0]
        top_indices = np.argsort(-similarities)[:limit]

        results = []
        for idx in top_indices:
            score = float(similarities[idx]) * 100.0
            candidate = candidates[idx]
            explanation = f"{round(score, 1)}% match for '{preset['name']}' mood ({preset['description'][:50]}...)"
            results.append(_format_song_dict(candidate, score, explanation))

        return results

    def list_mood_presets(self) -> List[Dict[str, Any]]:
        """Return available mood presets with descriptions."""
        return [
            {
                "id": k,
                "name": v["name"],
                "description": v["description"],
            }
            for k, v in MOOD_PRESETS.items()
        ]

    def generate_prompt_playlist(
        self,
        prompt: str,
        limit: int = 12,
        db: Optional[Session] = None,
    ) -> Dict[str, Any]:
        """
        Generate a personalized playlist matching a natural language prompt.
        """
        from app.recommender.prompt_parser import parse_prompt_to_vector

        target_dict, title, description = parse_prompt_to_vector(prompt)
        target_vec = extract_feature_vector(target_dict, apply_weights=True).reshape(1, -1)

        candidates = db.query(Song).all() if db else []
        if not candidates:
            return {
                "title": title,
                "description": description,
                "prompt": prompt,
                "tracks": [],
            }

        candidate_matrix = np.array(
            [extract_feature_vector(c, apply_weights=True) for c in candidates],
            dtype=np.float32,
        )

        similarities = cosine_similarity(target_vec, candidate_matrix)[0]
        top_indices = np.argsort(-similarities)[:limit]

        results = []
        for idx in top_indices:
            score = float(similarities[idx]) * 100.0
            candidate = candidates[idx]
            explanation = f"{round(score, 1)}% match for prompt '{prompt[:35]}'"
            results.append(_format_song_dict(candidate, score, explanation))

        return {
            "title": title,
            "description": description,
            "prompt": prompt,
            "tracks": results,
        }


recommendation_engine = RecommendationEngine()


