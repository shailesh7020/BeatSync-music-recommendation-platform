from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app.services.music_service import music_service

router = APIRouter(prefix="/music", tags=["Music"])


@router.get("/search")
def search_music(
    q: str = Query(..., min_length=1, description="Track title or artist to search"),
    limit: int = Query(10, ge=1, le=50, description="Maximum results to return"),
    db: Session = Depends(get_db),
):
    """
    Search for music tracks across Spotify and fallback catalogs.
    Automatically indexes retrieved tracks and their audio feature vectors into the database.
    """
    tracks = music_service.search_and_index_tracks(query=q, limit=limit, db=db)
    return {
        "query": q,
        "count": len(tracks),
        "results": tracks,
    }


@router.get("/track/{spotify_id}")
def get_track_details(
    spotify_id: str,
    db: Session = Depends(get_db),
):
    """
    Retrieve track metadata and complete audio features by track ID.
    """
    track = music_service.get_track_details(spotify_id=spotify_id, db=db)
    if not track:
        raise HTTPException(status_code=404, detail=f"Track '{spotify_id}' not found")
    return track


@router.get("/playback")
def resolve_playback(
    artist: str = Query(..., min_length=1, description="Artist name"),
    title: str = Query(..., min_length=1, description="Song title"),
    spotify_id: Optional[str] = Query(None, description="Optional track ID to associate with YouTube stream"),
    db: Session = Depends(get_db),
):
    """
    Resolve a YouTube video stream / embed URL for a given track.
    Caches the association in the database for subsequent fast lookups.
    """
    playback_info = music_service.resolve_playback(
        artist=artist, title=title, spotify_id=spotify_id, db=db
    )
    if not playback_info:
        raise HTTPException(
            status_code=404,
            detail=f"Could not resolve playback stream for '{title}' by '{artist}'",
        )
    return playback_info


@router.get("/popular")
def get_popular_tracks(
    category: str = Query("all", description="Popular category ('all', 'spotify_hits', 'charts', 'pop', 'hiphop', 'dance', 'rock')"),
    limit: int = Query(20, ge=1, le=50, description="Max songs to return"),
    db: Session = Depends(get_db),
):
    """
    Get the most popular and trending songs referenced from Spotify Global Charts & Top Hits.
    """
    tracks = music_service.get_popular_tracks(category=category, limit=limit, db=db)
    return {
        "category": category,
        "count": len(tracks),
        "tracks": tracks,
    }
