import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.database import SessionLocal, init_db
from app.models import User, Song, ListeningHistory, LikedSong

client = TestClient(app)


@pytest.fixture(scope="session", autouse=True)
def setup_database():
    init_db()


def test_root_endpoint():
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert "Welcome to Music Recommendation Platform API" in data["message"]
    assert "/api/v1/docs" in data["docs"]


def test_health_check_endpoint():
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["database"] == "healthy"
    assert "integrations" in data
    assert "spotify_configured" in data["integrations"]
    assert "youtube_configured" in data["integrations"]


import uuid


def test_database_models_crud():
    db = SessionLocal()
    unique_suffix = uuid.uuid4().hex[:8]
    test_username = f"user_{unique_suffix}"
    test_email = f"user_{unique_suffix}@example.com"
    test_spotify_id = f"spotify_{unique_suffix}"

    user = None
    song = None
    try:
        # 1. Create a test user
        user = User(username=test_username, email=test_email)
        db.add(user)
        db.commit()
        db.refresh(user)
        assert user.id is not None
        assert user.username == test_username

        # 2. Create a test song with audio features
        song = Song(
            spotify_id=test_spotify_id,
            title="Bohemian Rhapsody",
            artist="Queen",
            album="A Night at the Opera",
            danceability=0.392,
            energy=0.402,
            valence=0.228,
            tempo=143.883,
        )
        db.add(song)
        db.commit()
        db.refresh(song)
        assert song.id is not None
        assert song.artist == "Queen"
        assert song.danceability == 0.392

        # 3. Create listening history interaction
        history = ListeningHistory(
            user_id=user.id,
            song_id=song.id,
            play_duration_sec=354.0,
            completed=True,
            skipped=False,
        )
        db.add(history)
        db.commit()
        db.refresh(history)
        assert history.id is not None
        assert history.completed is True

        # 4. Create liked song
        like = LikedSong(user_id=user.id, song_id=song.id, rating=5.0)
        db.add(like)
        db.commit()
        db.refresh(like)
        assert like.id is not None
        assert like.rating == 5.0

    finally:
        # Cleanup test records
        if user and user.id:
            db.query(LikedSong).filter(LikedSong.user_id == user.id).delete()
            db.query(ListeningHistory).filter(ListeningHistory.user_id == user.id).delete()
            db.query(User).filter(User.id == user.id).delete()
        if song and song.id:
            db.query(Song).filter(Song.id == song.id).delete()
        db.commit()
        db.close()

