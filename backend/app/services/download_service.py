import os
import glob
import re
import logging
from typing import Optional, Dict, Any, List
import yt_dlp

from app.services.youtube_service import youtube_service

logger = logging.getLogger("app.services.download")


def _sanitize_filename(name: str) -> str:
    """Remove unsafe filesystem characters for Windows/Linux/macOS."""
    return re.sub(r'[\\/*?:"<>|]', "", name).strip()


class DownloadService:
    """
    Downloads full audio tracks directly to laptop storage for offline playback.
    """

    def __init__(self, download_dir: Optional[str] = None):
        if download_dir:
            self.download_dir = download_dir
        else:
            base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
            self.download_dir = os.path.join(base_dir, "downloads")

        os.makedirs(self.download_dir, exist_ok=True)

    def download_track(
        self, artist: str, title: str, youtube_id: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """
        Download a full-length track as high-quality audio file.
        Returns the absolute local file path, display filename, and media type.
        """
        # 1. Resolve YouTube video ID if missing
        video_id = youtube_id
        if not video_id:
            yt_info = youtube_service.search_video(artist=artist, track_title=title)
            if yt_info:
                video_id = yt_info["video_id"]

        if not video_id:
            logger.error(f"Could not resolve video stream for {artist} - {title}")
            return None

        # 2. Check if already downloaded on laptop
        existing_files = glob.glob(os.path.join(self.download_dir, f"{video_id}.*"))
        clean_name = f"{_sanitize_filename(artist)} - {_sanitize_filename(title)}"

        if existing_files:
            file_path = existing_files[0]
            ext = os.path.splitext(file_path)[1]
            return {
                "file_path": file_path,
                "filename": f"{clean_name}{ext}",
                "file_size": os.path.getsize(file_path),
                "video_id": video_id,
                "media_type": "audio/mp4" if ext == ".m4a" else "audio/webm",
                "cached": True,
            }

        # 3. Download audio stream via yt-dlp
        url = f"https://www.youtube.com/watch?v={video_id}"
        ydl_opts = {
            "format": "bestaudio[ext=m4a]/bestaudio/best",
            "outtmpl": os.path.join(self.download_dir, f"{video_id}.%(ext)s"),
            "quiet": True,
            "no_warnings": True,
            "noplaylist": True,
        }

        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                ydl.download([url])

            downloaded_files = glob.glob(os.path.join(self.download_dir, f"{video_id}.*"))
            if downloaded_files:
                file_path = downloaded_files[0]
                ext = os.path.splitext(file_path)[1]
                return {
                    "file_path": file_path,
                    "filename": f"{clean_name}{ext}",
                    "file_size": os.path.getsize(file_path),
                    "video_id": video_id,
                    "media_type": "audio/mp4" if ext == ".m4a" else "audio/webm",
                    "cached": False,
                }
        except Exception as e:
            logger.error(f"Failed to download audio for {video_id}: {e}")

        return None

    def list_downloaded_tracks(self) -> List[Dict[str, Any]]:
        """List all tracks currently downloaded for offline play."""
        files = glob.glob(os.path.join(self.download_dir, "*.*"))
        results = []
        for f in files:
            base = os.path.basename(f)
            ext = os.path.splitext(f)[1]
            size_mb = round(os.path.getsize(f) / (1024 * 1024), 2)
            results.append({
                "filename": base,
                "file_path": f,
                "size_mb": size_mb,
                "format": ext.replace(".", "").upper(),
            })
        return results


download_service = DownloadService()
