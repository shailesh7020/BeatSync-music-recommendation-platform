from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Float, DateTime
from sqlalchemy.orm import relationship
from app.database import Base


class Song(Base):
    __tablename__ = "songs"

    id = Column(Integer, primary_key=True, index=True)
    spotify_id = Column(String(100), unique=True, index=True, nullable=False)
    title = Column(String(255), index=True, nullable=False)
    artist = Column(String(255), index=True, nullable=False)
    album = Column(String(255), nullable=True)
    duration_ms = Column(Integer, nullable=True)
    release_date = Column(String(30), nullable=True)
    preview_url = Column(String(500), nullable=True)
    image_url = Column(String(500), nullable=True)
    youtube_id = Column(String(100), nullable=True)

    # Audio features for recommendation algorithms
    danceability = Column(Float, nullable=True)
    energy = Column(Float, nullable=True)
    key = Column(Integer, nullable=True)
    loudness = Column(Float, nullable=True)
    mode = Column(Integer, nullable=True)
    speechiness = Column(Float, nullable=True)
    acousticness = Column(Float, nullable=True)
    instrumentalness = Column(Float, nullable=True)
    liveness = Column(Float, nullable=True)
    valence = Column(Float, nullable=True)
    tempo = Column(Float, nullable=True)

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    # Relationships
    listening_history = relationship("ListeningHistory", back_populates="song")
    liked_by = relationship("LikedSong", back_populates="song")
    playlist_tracks = relationship("PlaylistTrack", back_populates="song")
