import os
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services.download_service import download_service, _sanitize_filename

client = TestClient(app)


def test_sanitize_filename():
    unsafe = 'Queen / Bohemian: Rhapsody? * <Remastered> |'
    safe = _sanitize_filename(unsafe)
    assert "/" not in safe
    assert ":" not in safe
    assert "?" not in safe
    assert "<" not in safe
    assert ">" not in safe
    assert "|" not in safe
    assert "Queen" in safe


def test_download_service_directory():
    assert os.path.exists(download_service.download_dir)
    assert os.path.isdir(download_service.download_dir)


def test_list_offline_tracks():
    res = client.get("/api/v1/download/offline-list")
    assert res.status_code == 200
    data = res.json()
    assert "count" in data
    assert "tracks" in data


def test_download_endpoint_with_cached_file():
    # Create a small dummy audio file in download_dir to verify download endpoint attachment headers
    dummy_video_id = "test_vid_12345"
    dummy_file = os.path.join(download_service.download_dir, f"{dummy_video_id}.m4a")
    with open(dummy_file, "wb") as f:
        f.write(b"M4A_DUMMY_AUDIO_DATA_FOR_OFFLINE_TEST")

    try:
        res = client.get(
            f"/api/v1/download/song?artist=Queen&title=Bohemian+Rhapsody&youtube_id={dummy_video_id}"
        )
        assert res.status_code == 200
        assert "attachment" in res.headers.get("content-disposition", "")
        assert "Queen - Bohemian Rhapsody.m4a" in res.headers.get("content-disposition", "")
        assert res.content == b"M4A_DUMMY_AUDIO_DATA_FOR_OFFLINE_TEST"
    finally:
        if os.path.exists(dummy_file):
            os.remove(dummy_file)
