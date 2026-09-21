import logging
from typing import Optional, Dict, Any, List
from sqlalchemy.orm import Session
from app.models.song import Song
from app.services.spotify_service import spotify_service
from app.services.youtube_service import youtube_service

logger = logging.getLogger("app.services.music")


class MusicService:
    """
    Unified music service orchestrating metadata fetching, playback resolution,
    and automatic database indexing.
    """

    def __init__(self):
        self.spotify = spotify_service
        self.youtube = youtube_service

    def search_and_index_tracks(
        self, query: str, limit: int = 10, db: Optional[Session] = None
    ) -> List[Dict[str, Any]]:
        """
        Search for tracks across providers and index new tracks into the local database
        so they become part of the recommendation catalog.
        """
        tracks = self.spotify.search_tracks(query=query, limit=limit)

        if db and tracks:
            try:
                for t in tracks:
                    sp_id = t["spotify_id"]
                    existing = db.query(Song).filter(Song.spotify_id == sp_id).first()
                    if not existing:
                        new_song = Song(
                            spotify_id=sp_id,
                            title=t["title"],
                            artist=t["artist"],
                            album=t.get("album"),
                            duration_ms=t.get("duration_ms"),
                            release_date=t.get("release_date"),
                            preview_url=t.get("preview_url"),
                            image_url=t.get("image_url"),
                            youtube_id=t.get("youtube_id"),
                            danceability=t.get("danceability"),
                            energy=t.get("energy"),
                            key=t.get("key"),
                            loudness=t.get("loudness"),
                            mode=t.get("mode"),
                            speechiness=t.get("speechiness"),
                            acousticness=t.get("acousticness"),
                            instrumentalness=t.get("instrumentalness"),
                            liveness=t.get("liveness"),
                            valence=t.get("valence"),
                            tempo=t.get("tempo"),
                        )
                        db.add(new_song)
                db.commit()
            except Exception as e:
                logger.warning(f"Failed to auto-index tracks into database: {e}")
                db.rollback()

        return tracks

    def get_track_details(
        self, spotify_id: str, db: Optional[Session] = None
    ) -> Optional[Dict[str, Any]]:
        """
        Get track details from local database or external provider.
        """
        if db:
            song = db.query(Song).filter(Song.spotify_id == spotify_id).first()
            if song:
                return {
                    "id": song.id,
                    "spotify_id": song.spotify_id,
                    "title": song.title,
                    "artist": song.artist,
                    "album": song.album,
                    "duration_ms": song.duration_ms,
                    "release_date": song.release_date,
                    "preview_url": song.preview_url,
                    "image_url": song.image_url,
                    "youtube_id": song.youtube_id,
                    "danceability": song.danceability,
                    "energy": song.energy,
                    "key": song.key,
                    "loudness": song.loudness,
                    "mode": song.mode,
                    "speechiness": song.speechiness,
                    "acousticness": song.acousticness,
                    "instrumentalness": song.instrumentalness,
                    "liveness": song.liveness,
                    "valence": song.valence,
                    "tempo": song.tempo,
                    "created_at": song.created_at,
                }

        # Fallback to provider lookup
        track = self.spotify.get_track_by_id(spotify_id)
        if track and db:
            try:
                new_song = Song(
                    spotify_id=track["spotify_id"],
                    title=track["title"],
                    artist=track["artist"],
                    album=track.get("album"),
                    duration_ms=track.get("duration_ms"),
                    release_date=track.get("release_date"),
                    preview_url=track.get("preview_url"),
                    image_url=track.get("image_url"),
                    danceability=track.get("danceability"),
                    energy=track.get("energy"),
                    key=track.get("key"),
                    loudness=track.get("loudness"),
                    mode=track.get("mode"),
                    speechiness=track.get("speechiness"),
                    acousticness=track.get("acousticness"),
                    instrumentalness=track.get("instrumentalness"),
                    liveness=track.get("liveness"),
                    valence=track.get("valence"),
                    tempo=track.get("tempo"),
                )
                db.add(new_song)
                db.commit()
                db.refresh(new_song)
                track["id"] = new_song.id
            except Exception as e:
                logger.warning(f"Could not persist track {spotify_id}: {e}")
                db.rollback()

        return track

    def resolve_playback(
        self,
        artist: str,
        title: str,
        spotify_id: Optional[str] = None,
        db: Optional[Session] = None,
    ) -> Optional[Dict[str, Any]]:
        """
        Resolve YouTube video playback for an audio track and cache the youtube_id in DB.
        """
        # 1. Check if DB already has the youtube_id cached for this track
        if db:
            song = None
            if spotify_id:
                song = db.query(Song).filter(Song.spotify_id == spotify_id).first()
            if not song or not song.youtube_id:
                song = (
                    db.query(Song)
                    .filter(
                        Song.artist.ilike(f"%{artist.strip()}%"),
                        Song.title.ilike(f"%{title.strip()}%"),
                        Song.youtube_id.isnot(None),
                    )
                    .first()
                )
            if song and song.youtube_id:
                vid = song.youtube_id
                return {
                    "video_id": vid,
                    "title": f"{song.artist} - {song.title}",
                    "embed_url": f"https://www.youtube.com/embed/{vid}",
                    "watch_url": f"https://www.youtube.com/watch?v={vid}",
                    "cached_in_db": True,
                }

        # 2. Resolve via YouTube API or zero-credential scraper
        yt_info = self.youtube.search_video(artist=artist, track_title=title)
        if yt_info:
            # Cache youtube_id into DB record for subsequent instant lookups
            if db:
                try:
                    song = None
                    if spotify_id:
                        song = db.query(Song).filter(Song.spotify_id == spotify_id).first()
                    if not song:
                        song = (
                            db.query(Song)
                            .filter(
                                Song.artist.ilike(f"%{artist.strip()}%"),
                                Song.title.ilike(f"%{title.strip()}%"),
                            )
                            .first()
                        )
                    if song:
                        song.youtube_id = yt_info["video_id"]
                        db.commit()
                except Exception as e:
                    logger.warning(f"Failed to update song with youtube_id: {e}")
                    db.rollback()

            return yt_info

        return None

    def get_popular_tracks(
        self, category: str = "all", limit: int = 20, db: Optional[Session] = None
    ) -> List[Dict[str, Any]]:
        """
        Fetch popular songs referenced from Spotify Global Hits and Charts.
        Automatically indexes tracks into the database so IDs exist for liking and similarity matching.
        """
        tracks = self.spotify.get_popular_tracks(category=category, limit=limit)
        if db and tracks:
            try:
                for t in tracks:
                    sid = t.get("spotify_id")
                    if not sid:
                        continue
                    existing = db.query(Song).filter(Song.spotify_id == sid).first()
                    if not existing:
                        new_song = Song(
                            spotify_id=sid,
                            title=t.get("title", "Unknown"),
                            artist=t.get("artist", "Unknown"),
                            album=t.get("album"),
                            duration_ms=t.get("duration_ms"),
                            release_date=t.get("release_date"),
                            preview_url=t.get("preview_url"),
                            image_url=t.get("image_url"),
                            youtube_id=t.get("youtube_id"),
                            danceability=t.get("danceability"),
                            energy=t.get("energy"),
                            key=t.get("key"),
                            loudness=t.get("loudness"),
                            mode=t.get("mode"),
                            speechiness=t.get("speechiness"),
                            acousticness=t.get("acousticness"),
                            instrumentalness=t.get("instrumentalness"),
                            liveness=t.get("liveness"),
                            valence=t.get("valence"),
                            tempo=t.get("tempo"),
                        )
                        db.add(new_song)
                db.commit()

                for t in tracks:
                    sid = t.get("spotify_id")
                    if sid:
                        s = db.query(Song).filter(Song.spotify_id == sid).first()
                        if s:
                            t["id"] = s.id
            except Exception as e:
                logger.warning(f"Failed to auto-index popular tracks: {e}")
                db.rollback()

        return tracks


music_service = MusicService()
