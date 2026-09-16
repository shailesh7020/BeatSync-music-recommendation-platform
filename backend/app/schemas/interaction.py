from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field


class ListeningHistoryCreate(BaseModel):
    user_id: int
    song_id: int
    play_duration_sec: float = Field(default=0.0, ge=0.0)
    completed: bool = False
    skipped: bool = False


class ListeningHistoryRead(ListeningHistoryCreate):
    id: int
    played_at: datetime

    model_config = ConfigDict(from_attributes=True)


class LikedSongToggle(BaseModel):
    user_id: int
    song_id: int
    rating: float = Field(default=1.0, ge=0.0, le=5.0)


class LikedSongRead(LikedSongToggle):
    id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class PlaylistCreate(BaseModel):
    user_id: int
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = Field(default=None, max_length=255)


class PlaylistRead(PlaylistCreate):
    id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
