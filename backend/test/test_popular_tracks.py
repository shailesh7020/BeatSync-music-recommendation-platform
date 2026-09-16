import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_get_popular_tracks_default():
    response = client.get("/api/v1/music/popular?category=all&limit=5")
    assert response.status_code == 200
    data = response.json()
    assert "category" in data
    assert data["category"] == "all"
    assert "tracks" in data
    assert len(data["tracks"]) > 0
    track = data["tracks"][0]
    assert "title" in track
    assert "artist" in track
    assert "danceability" in track
    assert "energy" in track


def test_get_popular_tracks_charts():
    response = client.get("/api/v1/music/popular?category=charts&limit=3")
    assert response.status_code == 200
    data = response.json()
    assert data["category"] == "charts"
    assert len(data["tracks"]) > 0


def test_get_popular_tracks_genres():
    for genre in ["pop", "rock"]:
        response = client.get(f"/api/v1/music/popular?category={genre}&limit=2")
        assert response.status_code == 200
        data = response.json()
        assert len(data["tracks"]) > 0
