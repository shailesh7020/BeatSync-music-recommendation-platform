import uuid
import pytest
from fastapi.testclient import TestClient
import numpy as np

from app.main import app
from app.database import SessionLocal, init_db
from app.models.song import Song
from app.models.user import User
from app.models.interaction import LikedSong, ListeningHistory
from app.recommender.features import extract_feature_vector
from app.recommender.engine import recommendation_engine, MOOD_PRESETS
from app.utils.seed import seed_database

client = TestClient(app)


@pytest.fixture(scope="session", autouse=True)
def setup_recommender_data():
    init_db()
    db = SessionLocal()
    try:
        seed_database(db)
    finally:
        db.close()


def test_feature_extraction():
    dummy_song = {
        "danceability": 0.8,
        "energy": 0.9,
        "loudness": -5.0,
        "speechiness": 0.05,
        "acousticness": 0.1,
        "instrumentalness": 0.0,
        "liveness": 0.2,
        "valence": 0.7,
        "tempo": 128.0,
    }
    vec = extract_feature_vector(dummy_song)
    assert isinstance(vec, np.ndarray)
    assert vec.shape == (9,)
    assert 0.0 <= vec[0] <= 1.0  # danceability
    assert 0.0 <= vec[1] <= 1.0  # energy
    assert 0.0 <= vec[8] <= 1.0  # tempo normalized


def test_similar_tracks_ranking():
    db = SessionLocal()
    try:
        seed_song = db.query(Song).filter(Song.title == "Bohemian Rhapsody").first()
        if not seed_song:
            seed_song = db.query(Song).first()
        assert seed_song is not None

        similar = recommendation_engine.get_similar_tracks(
            song_identifier=seed_song.id, limit=5, db=db
        )
        assert len(similar) > 0
        assert seed_song.id not in [s["id"] for s in similar]

        # Verify descending order of similarity
        scores = [s["similarity_score"] for s in similar]
        assert scores == sorted(scores, reverse=True)
        assert all(0.0 <= s <= 100.0 for s in scores)
        assert "explanation" in similar[0]
    finally:
        db.close()


def test_mood_recommendations():
    db = SessionLocal()
    try:
        # Workout mood
        workout = recommendation_engine.get_mood_recommendations("workout", limit=3, db=db)
        assert len(workout) > 0
        assert workout[0]["energy"] >= 0.5

        # Study mood
        study = recommendation_engine.get_mood_recommendations("study", limit=3, db=db)
        assert len(study) > 0

        # Invalid mood raises ValueError
        with pytest.raises(ValueError):
            recommendation_engine.get_mood_recommendations("nonexistent_mood_xyz", db=db)
    finally:
        db.close()


def test_user_recommendations_cold_start_and_personalized():
    db = SessionLocal()
    suffix = uuid.uuid4().hex[:8]
    user = User(username=f"rec_user_{suffix}", email=f"rec_{suffix}@example.com")
    db.add(user)
    db.commit()
    db.refresh(user)

    try:
        # 1. Cold start check
        cold_start_recs = recommendation_engine.get_user_recommendations(
            user_id=user.id, limit=3, db=db
        )
        assert len(cold_start_recs) > 0

        # 2. Add preference for Electronic song
        edm_song = db.query(Song).filter(Song.artist.like("%Daft Punk%")).first()
        if edm_song:
            like = LikedSong(user_id=user.id, song_id=edm_song.id, rating=5.0)
            db.add(like)
            db.commit()

            personalized_recs = recommendation_engine.get_user_recommendations(
                user_id=user.id, limit=5, db=db
            )
            assert len(personalized_recs) > 0
            # Liked song should be excluded from candidate recommendations
            rec_ids = [r["id"] for r in personalized_recs]
            assert edm_song.id not in rec_ids

    finally:
        db.query(LikedSong).filter(LikedSong.user_id == user.id).delete()
        db.query(User).filter(User.id == user.id).delete()
        db.commit()
        db.close()


def test_api_recommender_endpoints():
    # 1. List moods
    res = client.get("/api/v1/recommendations/moods")
    assert res.status_code == 200
    data = res.json()
    assert "moods" in data
    assert any(m["id"] == "workout" for m in data["moods"])

    # 2. Mood recommendations
    res = client.get("/api/v1/recommendations/mood?mood=party&limit=2")
    assert res.status_code == 200
    party_data = res.json()
    assert party_data["mood"] == "party"
    assert len(party_data["recommendations"]) > 0

    # 3. Similar tracks endpoint
    db = SessionLocal()
    try:
        song = db.query(Song).first()
        assert song is not None
        res = client.get(f"/api/v1/recommendations/similar/{song.id}?limit=2")
        assert res.status_code == 200
        sim_data = res.json()
        assert len(sim_data["recommendations"]) > 0
    finally:
        db.close()
