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

    def _search_video_fallback(self, artist: str, track_title: str) -> Optional[Dict[str, Any]]:
        """
        Fast, zero-credential scraper fallback to resolve YouTube video ID in ~1s.
        Extracts video ID from public YouTube search response without requiring YouTube Data API keys.
        """
        import re
        import urllib.parse

        clean_artist = artist.strip()
        clean_title = track_title.strip()
        queries = [
            f"{clean_artist} - {clean_title} official audio",
            f"{clean_artist} - {clean_title}",
        ]
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept-Language": "en-US,en;q=0.9",
        }

        for q in queries:
            try:
                encoded = urllib.parse.quote(q)
                url = f"https://www.youtube.com/results?search_query={encoded}"
                resp = requests.get(url, headers=headers, timeout=5)
                if resp.status_code == 200:
                    matches = re.findall(r'"videoId":"([a-zA-Z0-9_-]{11})"', resp.text)
                    if matches:
                        vid = matches[0]
                        result = {
                            "video_id": vid,
                            "title": f"{clean_artist} - {clean_title}",
                            "channel_title": clean_artist,
                            "thumbnail_url": f"https://i.ytimg.com/vi/{vid}/hqdefault.jpg",
                            "embed_url": f"https://www.youtube.com/embed/{vid}",
                            "watch_url": f"https://www.youtube.com/watch?v={vid}",
                        }
                        return result
            except Exception as e:
                logger.warning(f"YouTube scrape fallback error for query '{q}': {e}")
                continue

        return None

    def search_video(self, artist: str, track_title: str) -> Optional[Dict[str, Any]]:
        """
        Search for the best YouTube video matching artist and track title.
        Returns a dictionary with video_id, title, embed_url, and thumbnail_url.
        Uses YouTube Data API v3 if key configured, with automatic instant fallback to open scraper.
        """
        cache_key = f"yt:{artist.strip().lower()}:{track_title.strip().lower()}"
        cached = youtube_cache.get(cache_key)
        if cached is not None:
            logger.debug(f"Cache hit for YouTube video: {cache_key}")
            return cached

        # 1. Try official YouTube Data API v3 if API key is provided
        if self.api_key:
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
                    response = requests.get(self.SEARCH_URL, params=params, timeout=5)
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
                    logger.warning(f"Error querying YouTube API for '{query}': {e}")
                    break

        # 2. Fast resilient fallback: direct scrape without requiring API key
        fallback_result = self._search_video_fallback(artist, track_title)
        if fallback_result:
            youtube_cache.set(cache_key, fallback_result)
            return fallback_result

        return None


youtube_service = YouTubeService()
