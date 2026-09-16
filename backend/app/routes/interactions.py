import logging
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.interaction import LikedSong, ListeningHistory
from app.models.song import Song
from app.models.user import User
from app.schemas.interaction import LikedSongToggle, ListeningHistoryCreate

logger = logging.getLogger("app.routes.interactions")

router = APIRouter(prefix="/interactions", tags=["User Interactions"])


@router.post("/like")
def toggle_like_song(payload: LikedSongToggle, db: Session = Depends(get_db)):
    """
    Toggle like / favorite status of a song for a user.
    If the song is already liked, removes the like. If not, adds the like.
    """
    # Ensure user exists (auto-create demo user if missing for development ease)
    user = db.query(User).filter(User.id == payload.user_id).first()
    if not user:
        user = User(id=payload.user_id, username=f"user_{payload.user_id}", email=f"user{payload.user_id}@beatsync.local")
        db.add(user)
        db.commit()

    # Ensure song exists
    song = db.query(Song).filter(Song.id == payload.song_id).first()
    if not song:
        raise HTTPException(status_code=404, detail="Song not found")

    existing_like = (
        db.query(LikedSong)
        .filter(LikedSong.user_id == payload.user_id, LikedSong.song_id == payload.song_id)
        .first()
    )

    if existing_like:
        db.delete(existing_like)
        db.commit()
        return {
            "liked": False,
            "user_id": payload.user_id,
            "song_id": payload.song_id,
            "message": f"Removed '{song.title}' from favorites",
        }
    else:
        new_like = LikedSong(
            user_id=payload.user_id,
            song_id=payload.song_id,
            rating=payload.rating,
        )
        db.add(new_like)
        db.commit()
        return {
            "liked": True,
            "user_id": payload.user_id,
            "song_id": payload.song_id,
            "message": f"Added '{song.title}' to favorites",
        }


@router.post("/play")
def record_play_interaction(
    payload: ListeningHistoryCreate, db: Session = Depends(get_db)
):
    """
    Record playback feedback (play duration, completed, or skipped) for user taste profiling.
    """
    # Ensure user exists
    user = db.query(User).filter(User.id == payload.user_id).first()
    if not user:
        user = User(id=payload.user_id, username=f"user_{payload.user_id}", email=f"user{payload.user_id}@beatsync.local")
        db.add(user)
        db.commit()

    # Ensure song exists
    song = db.query(Song).filter(Song.id == payload.song_id).first()
    if not song:
        raise HTTPException(status_code=404, detail="Song not found")

    history = ListeningHistory(
        user_id=payload.user_id,
        song_id=payload.song_id,
        play_duration_sec=payload.play_duration_sec,
        completed=payload.completed,
        skipped=payload.skipped,
    )
    db.add(history)
    db.commit()
    db.refresh(history)

    return {
        "status": "recorded",
        "history_id": history.id,
        "completed": history.completed,
        "skipped": history.skipped,
    }


@router.get("/likes/{user_id}")
def get_user_likes(user_id: int, db: Session = Depends(get_db)):
    """
    Retrieve list of all liked songs for a user.
    """
    likes = db.query(LikedSong).filter(LikedSong.user_id == user_id).all()
    liked_songs = []
    for l in likes:
        if l.song:
            liked_songs.append({
                "id": l.song.id,
                "spotify_id": l.song.spotify_id,
                "title": l.song.title,
                "artist": l.song.artist,
                "image_url": l.song.image_url,
                "preview_url": l.song.preview_url,
                "liked_at": l.created_at,
            })
    return {
        "user_id": user_id,
        "count": len(liked_songs),
        "liked_song_ids": [s["id"] for s in liked_songs],
        "tracks": liked_songs,
    }


@router.get("/history/{user_id}")
def get_user_history(user_id: int, limit: int = 20, db: Session = Depends(get_db)):
    """
    Retrieve recent listening history for a user.
    """
    history = (
        db.query(ListeningHistory)
        .filter(ListeningHistory.user_id == user_id)
        .order_by(ListeningHistory.played_at.desc())
        .limit(limit)
        .all()
    )
    items = []
    for h in history:
        items.append({
            "history_id": h.id,
            "song_id": h.song_id,
            "title": h.song.title if h.song else "Unknown",
            "artist": h.song.artist if h.song else "Unknown",
            "played_at": h.played_at,
            "completed": h.completed,
            "skipped": h.skipped,
            "duration_sec": h.play_duration_sec,
        })
    return {
        "user_id": user_id,
        "count": len(items),
        "history": items,
    }
