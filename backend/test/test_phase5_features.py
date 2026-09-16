import uuid
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.database import SessionLocal, init_db
from app.models.song import Song
from app.models.user import User
from app.models.interaction import LikedSong, ListeningHistory
from app.recommender.prompt_parser import parse_prompt_to_vector
from app.utils.seed import seed_database

client = TestClient(app)


@pytest.fixture(scope="session", autouse=True)
def setup_seed():
    init_db()
    db = SessionLocal()
    try:
        seed_database(db)
    finally:
        db.close()


def test_prompt_parser():
    # 1. High energy workout prompt
    workout_vec, title, desc = parse_prompt_to_vector("heavy intense gym workout fast cardio")
    assert workout_vec["energy"] > 0.7
    assert workout_vec["tempo"] >= 130.0
    assert "Workout" in title or "Heavy" in title or "Gym" in title

    # 2. Chill rainy acoustic prompt
    chill_vec, c_title, c_desc = parse_prompt_to_vector("rainy chill acoustic piano study")
    assert chill_vec["energy"] < 0.4
    assert chill_vec["acousticness"] > 0.6


def test_prompt_playlist_endpoint():
    res = client.post(
        "/api/v1/recommendations/prompt",
        json={"prompt": "intense workout heavy beats", "limit": 3},
    )
    assert res.status_code == 200
    data = res.json()
    assert "title" in data
    assert "description" in data
    assert len(data["tracks"]) > 0
    first = data["tracks"][0]
    assert "title" in first
    assert "similarity_score" in first


def test_user_interaction_like_toggle():
    db = SessionLocal()
    suffix = uuid.uuid4().hex[:8]
    user = User(username=f"like_user_{suffix}", email=f"like_{suffix}@example.com")
    db.add(user)
    db.commit()
    db.refresh(user)

    song = db.query(Song).first()
    assert song is not None

    try:
        # 1. Like song
        res1 = client.post(
            "/api/v1/interactions/like",
            json={"user_id": user.id, "song_id": song.id, "rating": 5.0},
        )
        assert res1.status_code == 200
        assert res1.json()["liked"] is True

        # Check likes endpoint
        likes_res = client.get(f"/api/v1/interactions/likes/{user.id}")
        assert likes_res.status_code == 200
        assert song.id in likes_res.json()["liked_song_ids"]

        # 2. Toggle off (Unlike)
        res2 = client.post(
            "/api/v1/interactions/like",
            json={"user_id": user.id, "song_id": song.id, "rating": 5.0},
        )
        assert res2.status_code == 200
        assert res2.json()["liked"] is False

    finally:
        db.query(LikedSong).filter(LikedSong.user_id == user.id).delete()
        db.query(User).filter(User.id == user.id).delete()
        db.commit()
        db.close()


def test_user_interaction_play_recording():
    db = SessionLocal()
    suffix = uuid.uuid4().hex[:8]
    user = User(username=f"play_user_{suffix}", email=f"play_{suffix}@example.com")
    db.add(user)
    db.commit()
    db.refresh(user)

    song = db.query(Song).first()
    assert song is not None

    try:
        res = client.post(
            "/api/v1/interactions/play",
            json={
                "user_id": user.id,
                "song_id": song.id,
                "play_duration_sec": 30.0,
                "completed": True,
                "skipped": False,
            },
        )
        assert res.status_code == 200
        assert res.json()["status"] == "recorded"

        # Check history endpoint
        hist_res = client.get(f"/api/v1/interactions/history/{user.id}")
        assert hist_res.status_code == 200
        assert hist_res.json()["count"] >= 1
    finally:
        db.query(ListeningHistory).filter(ListeningHistory.user_id == user.id).delete()
        db.query(User).filter(User.id == user.id).delete()
        db.commit()
        db.close()


def test_social_rooms_and_websocket():
    # 1. Active rooms REST endpoint
    res = client.get("/api/v1/rooms/active")
    assert res.status_code == 200
    assert "rooms" in res.json()

    # 2. Real-time WebSocket connection
    room_id = f"test_room_{uuid.uuid4().hex[:6]}"
    with client.websocket_connect(f"/ws/room/{room_id}?username=Tester") as ws:
        # Expect SYNC_STATE and USER_JOINED messages upon join
        msg1 = ws.receive_json()
        assert msg1["type"] == "SYNC_STATE"
        assert msg1["state"]["room_id"] == room_id

        msg_joined = ws.receive_json()
        assert msg_joined["type"] == "USER_JOINED"

        # Send CHANGE_TRACK event
        ws.send_json({
            "type": "CHANGE_TRACK",
            "track": {"title": "Test Track", "artist": "Test Artist"},
        })
        msg2 = ws.receive_json()
        assert msg2["type"] == "CHANGE_TRACK"
        assert msg2["track"]["title"] == "Test Track"

