import time
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.database import SessionLocal, init_db
from app.models.song import Song
from app.services.cache import SimpleTTLCache
from app.services.youtube_service import youtube_service
from app.services.spotify_service import spotify_service
from app.services.music_service import music_service

client = TestClient(app)


@pytest.fixture(scope="session", autouse=True)
def setup_database():
    init_db()


def test_ttl_cache():
    cache = SimpleTTLCache(default_ttl_seconds=1, max_size=5)
    cache.set("key1", "value1")
    assert cache.get("key1") == "value1"
    assert len(cache) == 1

    # Test TTL expiration
    time.sleep(1.1)
    assert cache.get("key1") is None


def test_youtube_service():
    result = youtube_service.search_video(artist="Queen", track_title="Bohemian Rhapsody")
    assert result is not None
    assert "video_id" in result
    assert len(result["video_id"]) > 0
    assert "embed_url" in result
    assert "https://www.youtube.com/embed/" in result["embed_url"]
    assert "thumbnail_url" in result


def test_spotify_service_tracks():
    tracks = spotify_service.search_tracks(query="Daft Punk", limit=3)
    assert len(tracks) > 0
    track = tracks[0]
    assert "title" in track
    assert "artist" in track
    assert "spotify_id" in track
    # Verify audio feature dimensions for recommendation engine
    assert "danceability" in track and track["danceability"] is not None
    assert "energy" in track and track["energy"] is not None
    assert "tempo" in track and track["tempo"] is not None
    assert "valence" in track and track["valence"] is not None


def test_music_service_search_and_index():
    db = SessionLocal()
    try:
        tracks = music_service.search_and_index_tracks(query="The Beatles", limit=2, db=db)
        assert len(tracks) > 0
        first_id = tracks[0]["spotify_id"]

        # Verify song is saved into DB table
        db_song = db.query(Song).filter(Song.spotify_id == first_id).first()
        assert db_song is not None
        assert db_song.title == tracks[0]["title"]
    finally:
        db.close()


def test_api_music_search():
    response = client.get("/api/v1/music/search?q=Coldplay&limit=2")
    assert response.status_code == 200
    data = response.json()
    assert data["query"] == "Coldplay"
    assert data["count"] > 0
    assert len(data["results"]) > 0
    first = data["results"][0]
    assert "Coldplay" in first["artist"] or "Coldplay" in first["title"]


def test_api_music_playback():
    response = client.get("/api/v1/music/playback?artist=Coldplay&title=Yellow")
    assert response.status_code == 200
    data = response.json()
    assert "video_id" in data
    assert "embed_url" in data


def test_api_track_not_found():
    response = client.get("/api/v1/music/track/invalid_nonexistent_id_999999")
    assert response.status_code == 404
