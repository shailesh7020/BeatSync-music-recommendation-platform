from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict


class AudioFeatures(BaseModel):
    danceability: Optional[float] = None
    energy: Optional[float] = None
    key: Optional[int] = None
    loudness: Optional[float] = None
    mode: Optional[int] = None
    speechiness: Optional[float] = None
    acousticness: Optional[float] = None
    instrumentalness: Optional[float] = None
    liveness: Optional[float] = None
    valence: Optional[float] = None
    tempo: Optional[float] = None


class SongBase(BaseModel):
    spotify_id: str
    title: str
    artist: str
    album: Optional[str] = None
    duration_ms: Optional[int] = None
    release_date: Optional[str] = None
    preview_url: Optional[str] = None
    image_url: Optional[str] = None
    youtube_id: Optional[str] = None


class SongCreate(SongBase, AudioFeatures):
    pass


class SongRead(SongBase, AudioFeatures):
    id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
