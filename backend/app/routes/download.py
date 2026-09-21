import os
from typing import Optional
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import FileResponse
from app.services.download_service import download_service

router = APIRouter(prefix="/download", tags=["Offline Download"])


@router.get("/song")
def download_offline_song(
    artist: str = Query(..., min_length=1, description="Artist name"),
    title: str = Query(..., min_length=1, description="Song title"),
    youtube_id: Optional[str] = Query(None, description="Optional YouTube video ID"),
    preview_url: Optional[str] = Query(None, description="Optional direct audio preview URL fallback"),
):
    """
    Download a full song to the user's laptop for offline playback.
    Returns the audio file directly as a downloadable attachment.
    """
    result = download_service.download_track(
        artist=artist, title=title, youtube_id=youtube_id, preview_url=preview_url
    )
    if not result or not os.path.exists(result["file_path"]):
        raise HTTPException(
            status_code=500,
            detail=f"Could not download audio stream for '{title}' by '{artist}'",
        )

    return FileResponse(
        path=result["file_path"],
        media_type=result["media_type"],
        filename=result["filename"],
        headers={
            "Content-Disposition": f'attachment; filename="{result["filename"]}"'
        },
    )


@router.get("/stream")
def stream_audio(
    artist: str = Query(..., min_length=1, description="Artist name"),
    title: str = Query(..., min_length=1, description="Song title"),
    youtube_id: Optional[str] = Query(None, description="Optional YouTube video ID"),
    preview_url: Optional[str] = Query(None, description="Optional direct audio preview URL fallback"),
):
    """
    Stream full song audio directly inline (Content-Disposition: inline) for browser audio players.
    """
    result = download_service.download_track(
        artist=artist, title=title, youtube_id=youtube_id, preview_url=preview_url
    )
    if not result or not os.path.exists(result["file_path"]):
        raise HTTPException(
            status_code=500,
            detail=f"Could not stream audio for '{title}' by '{artist}'",
        )

    return FileResponse(
        path=result["file_path"],
        media_type=result["media_type"],
        filename=result["filename"],
        headers={
            "Content-Disposition": f'inline; filename="{result["filename"]}"',
            "Accept-Ranges": "bytes",
        },
    )


@router.get("/offline-list")
def list_offline_tracks():
    """
    List all tracks currently downloaded locally on this machine.
    """
    tracks = download_service.list_downloaded_tracks()
    return {
        "count": len(tracks),
        "tracks": tracks,
    }
