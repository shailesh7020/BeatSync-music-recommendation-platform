import logging
from typing import Optional, Dict, Any
import requests
from app.config import settings
from app.services.cache import youtube_cache

logger = logging.getLogger("app.services.youtube")


class YouTubeService:
    """
    Service to search and resolve YouTube video streams for music playback.
    Uses cached lookups to minimize YouTube Data API v3 quota consumption.
    """

    SEARCH_URL = "https://www.googleapis.com/youtube/v3/search"

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or settings.YOUTUBE_API_KEY

    def search_video(self, artist: str, track_title: str) -> Optional[Dict[str, Any]]:
        """
        Search for the best YouTube video matching artist and track title.
        Returns a dictionary with video_id, title, embed_url, and thumbnail_url.
        """
        if not self.api_key:
            logger.warning("YouTube API key not configured. Cannot resolve video playback.")
            return None

        cache_key = f"yt:{artist.strip().lower()}:{track_title.strip().lower()}"
        cached = youtube_cache.get(cache_key)
        if cached is not None:
            logger.debug(f"Cache hit for YouTube video: {cache_key}")
            return cached

        queries = [
            f"{artist} - {track_title} official audio",
            f"{artist} - {track_title}",
        ]

        for query in queries:
            try:
                params = {
                    "part": "snippet",
                    "q": query,
                    "type": "video",
                    "maxResults": 1,
                    "key": self.api_key,
                }
                response = requests.get(self.SEARCH_URL, params=params, timeout=6)
                if response.status_code == 200:
                    data = response.json()
                    items = data.get("items", [])
                    if items:
                        item = items[0]
                        video_id = item["id"]["videoId"]
                        snippet = item.get("snippet", {})
                        thumbnails = snippet.get("thumbnails", {})
                        thumb_url = (
                            thumbnails.get("high", {}).get("url")
                            or thumbnails.get("medium", {}).get("url")
                            or thumbnails.get("default", {}).get("url")
                        )

                        result = {
                            "video_id": video_id,
                            "title": snippet.get("title", f"{artist} - {track_title}"),
                            "channel_title": snippet.get("channelTitle", ""),
                            "thumbnail_url": thumb_url,
                            "embed_url": f"https://www.youtube.com/embed/{video_id}",
                            "watch_url": f"https://www.youtube.com/watch?v={video_id}",
                        }
                        youtube_cache.set(cache_key, result)
                        return result
                else:
                    logger.warning(
                        f"YouTube API returned status {response.status_code}: {response.text[:200]}"
                    )
            except Exception as e:
                logger.error(f"Error querying YouTube API for '{query}': {e}")
                break

        return None


youtube_service = YouTubeService()
