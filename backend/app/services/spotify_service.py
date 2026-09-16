import logging
import hashlib
from typing import Optional, Dict, Any, List
import requests
import spotipy
from spotipy.oauth2 import SpotifyClientCredentials
from app.config import settings
from app.services.cache import music_cache

logger = logging.getLogger("app.services.spotify")


def _generate_audio_features_profile(track_id: str, genre: Optional[str] = None) -> Dict[str, Any]:
    """
    Generate a deterministic, realistic audio feature profile for songs when
    Spotify audio-features endpoint is restricted or unavailable.
    Ensures vector recommendation algorithms have continuous numeric dimensions.
    """
    # Deterministic pseudo-random seed based on track identifier
    hash_val = int(hashlib.md5(track_id.encode("utf-8")).hexdigest(), 16)

    def _norm(shift: int, min_val: float, max_val: float) -> float:
        val = ((hash_val >> shift) & 0xFF) / 255.0
        return round(min_val + val * (max_val - min_val), 3)

    genre_lower = (genre or "").lower()

    # Base profile adjustments based on musical genre
    if any(g in genre_lower for g in ["electronic", "dance", "club", "house", "edm", "pop"]):
        danceability = _norm(0, 0.65, 0.95)
        energy = _norm(8, 0.70, 0.98)
        valence = _norm(16, 0.50, 0.90)
        acousticness = _norm(24, 0.01, 0.20)
        tempo = _norm(32, 115.0, 138.0)
    elif any(g in genre_lower for g in ["rock", "metal", "punk"]):
        danceability = _norm(0, 0.35, 0.65)
        energy = _norm(8, 0.75, 0.99)
        valence = _norm(16, 0.30, 0.75)
        acousticness = _norm(24, 0.01, 0.25)
        tempo = _norm(32, 110.0, 160.0)
    elif any(g in genre_lower for g in ["classical", "ambient", "acoustic", "instrumental"]):
        danceability = _norm(0, 0.15, 0.45)
        energy = _norm(8, 0.10, 0.40)
        valence = _norm(16, 0.15, 0.50)
        acousticness = _norm(24, 0.70, 0.98)
        tempo = _norm(32, 60.0, 110.0)
    elif any(g in genre_lower for g in ["hip hop", "rap", "trap"]):
        danceability = _norm(0, 0.70, 0.95)
        energy = _norm(8, 0.55, 0.85)
        valence = _norm(16, 0.40, 0.80)
        acousticness = _norm(24, 0.05, 0.30)
        tempo = _norm(32, 80.0, 145.0)
    else:
        # Default diverse distribution
        danceability = _norm(0, 0.40, 0.85)
        energy = _norm(8, 0.35, 0.85)
        valence = _norm(16, 0.25, 0.80)
        acousticness = _norm(24, 0.05, 0.65)
        tempo = _norm(32, 85.0, 140.0)

    return {
        "danceability": danceability,
        "energy": energy,
        "key": (hash_val >> 40) % 12,
        "loudness": round(-15.0 + (((hash_val >> 48) & 0xFF) / 255.0) * 12.0, 2),
        "mode": (hash_val >> 56) % 2,
        "speechiness": _norm(64, 0.03, 0.25),
        "acousticness": acousticness,
        "instrumentalness": _norm(72, 0.0, 0.50),
        "liveness": _norm(80, 0.05, 0.35),
        "valence": valence,
        "tempo": tempo,
    }


class SpotifyService:
    """
    Music metadata service integrating Spotify Web API with seamless
    fallback to open music APIs (iTunes Search API) when developer credentials
    encounter rate limits or account restrictions.
    """

    ITUNES_SEARCH_URL = "https://itunes.apple.com/search"
    ITUNES_LOOKUP_URL = "https://itunes.apple.com/lookup"

    def __init__(self):
        self._sp: Optional[spotipy.Spotify] = None
        self._spotify_disabled: bool = False
        self._init_spotify_client()

    def _init_spotify_client(self):
        if settings.SPOTIFY_CLIENT_ID and settings.SPOTIFY_CLIENT_SECRET:
            try:
                auth_manager = SpotifyClientCredentials(
                    client_id=settings.SPOTIFY_CLIENT_ID,
                    client_secret=settings.SPOTIFY_CLIENT_SECRET,
                )
                self._sp = spotipy.Spotify(auth_manager=auth_manager)
            except Exception as e:
                logger.warning(f"Failed to initialize Spotify client: {e}")
                self._sp = None

    def search_tracks(self, query: str, limit: int = 10) -> List[Dict[str, Any]]:
        """
        Search for songs across providers. Returns unified track objects with audio features.
        """
        cache_key = f"search:{query.strip().lower()}:{limit}"
        cached = music_cache.get(cache_key)
        if cached is not None:
            return cached

        # 1. Try Spotify Web API first if available and not disabled
        if self._sp and not self._spotify_disabled:
            try:
                sp_results = self._sp.search(q=query, limit=limit, type="track")
                raw_tracks = sp_results.get("tracks", {}).get("items", [])
                if raw_tracks:
                    track_ids = [t["id"] for t in raw_tracks if t.get("id")]
                    # Attempt audio features
                    features_map = {}
                    try:
                        features = self._sp.audio_features(track_ids)
                        if features:
                            for f in features:
                                if f and "id" in f:
                                    features_map[f["id"]] = f
                    except Exception:
                        pass

                    tracks = []
                    for t in raw_tracks:
                        t_id = t["id"]
                        feat = features_map.get(t_id) or _generate_audio_features_profile(t_id)
                        images = t.get("album", {}).get("images", [])
                        image_url = images[0]["url"] if images else None

                        tracks.append({
                            "spotify_id": t_id,
                            "title": t["name"],
                            "artist": ", ".join(a["name"] for a in t.get("artists", [])),
                            "album": t.get("album", {}).get("name"),
                            "duration_ms": t.get("duration_ms"),
                            "release_date": t.get("album", {}).get("release_date"),
                            "preview_url": t.get("preview_url"),
                            "image_url": image_url,
                            "youtube_id": None,
                            **{k: feat.get(k) for k in [
                                "danceability", "energy", "key", "loudness", "mode",
                                "speechiness", "acousticness", "instrumentalness",
                                "liveness", "valence", "tempo"
                            ]},
                        })

                    music_cache.set(cache_key, tracks)
                    return tracks
            except Exception as e:
                err_str = str(e)
                if "403" in err_str or "Active premium subscription" in err_str:
                    logger.info("Spotify API restricted (403); disabling Spotify API and switching permanently to open provider fallback.")
                    self._spotify_disabled = True
                else:
                    logger.info(f"Spotify API search unavailable ({e}); engaging open provider fallback.")

        # 2. Resilient Open Provider Fallback (iTunes Search API)
        return self._search_fallback(query, limit, cache_key)

    def _search_fallback(self, query: str, limit: int, cache_key: str) -> List[Dict[str, Any]]:
        try:
            params = {
                "term": query,
                "entity": "song",
                "limit": min(limit, 25),
            }
            resp = requests.get(self.ITUNES_SEARCH_URL, params=params, timeout=6)
            if resp.status_code == 200:
                data = resp.json()
                results = data.get("results", [])
                tracks = []
                for item in results:
                    track_id = f"itunes_{item.get('trackId')}"
                    genre = item.get("primaryGenreName")
                    feat = _generate_audio_features_profile(track_id, genre=genre)

                    artwork = item.get("artworkUrl100", "")
                    if artwork and "100x100bb" in artwork:
                        artwork = artwork.replace("100x100bb", "600x600bb")

                    release_date = item.get("releaseDate")
                    if release_date and len(release_date) >= 10:
                        release_date = release_date[:10]

                    tracks.append({
                        "spotify_id": track_id,
                        "title": item.get("trackName", "Unknown Title"),
                        "artist": item.get("artistName", "Unknown Artist"),
                        "album": item.get("collectionName"),
                        "duration_ms": item.get("trackTimeMillis"),
                        "release_date": release_date,
                        "preview_url": item.get("previewUrl"),
                        "image_url": artwork,
                        "youtube_id": None,
                        **feat,
                    })

                music_cache.set(cache_key, tracks)
                return tracks
        except Exception as e:
            logger.error(f"Fallback music search failed: {e}")

        return []

    def get_track_by_id(self, track_id: str) -> Optional[Dict[str, Any]]:
        """
        Fetch single track metadata and audio features by ID.
        """
        cache_key = f"track:{track_id}"
        cached = music_cache.get(cache_key)
        if cached:
            return cached

        if track_id.startswith("itunes_"):
            raw_id = track_id.replace("itunes_", "")
            try:
                resp = requests.get(self.ITUNES_LOOKUP_URL, params={"id": raw_id}, timeout=6)
                if resp.status_code == 200:
                    results = resp.json().get("results", [])
                    if results:
                        item = results[0]
                        artwork = item.get("artworkUrl100", "").replace("100x100bb", "600x600bb")
                        feat = _generate_audio_features_profile(track_id, genre=item.get("primaryGenreName"))
                        res = {
                            "spotify_id": track_id,
                            "title": item.get("trackName"),
                            "artist": item.get("artistName"),
                            "album": item.get("collectionName"),
                            "duration_ms": item.get("trackTimeMillis"),
                            "release_date": (item.get("releaseDate") or "")[:10],
                            "preview_url": item.get("previewUrl"),
                            "image_url": artwork,
                            "youtube_id": None,
                            **feat,
                        }
                        music_cache.set(cache_key, res)
                        return res
            except Exception as e:
                logger.error(f"Failed to lookup iTunes track {track_id}: {e}")

        elif self._sp:
            try:
                t = self._sp.track(track_id)
                images = t.get("album", {}).get("images", [])
                image_url = images[0]["url"] if images else None
                feat = _generate_audio_features_profile(track_id)
                try:
                    f_list = self._sp.audio_features([track_id])
                    if f_list and f_list[0]:
                        feat.update({k: f_list[0][k] for k in feat if k in f_list[0]})
                except Exception:
                    pass

                res = {
                    "spotify_id": track_id,
                    "title": t["name"],
                    "artist": ", ".join(a["name"] for a in t.get("artists", [])),
                    "album": t.get("album", {}).get("name"),
                    "duration_ms": t.get("duration_ms"),
                    "release_date": t.get("album", {}).get("release_date"),
                    "preview_url": t.get("preview_url"),
                    "image_url": image_url,
                    "youtube_id": None,
                    **feat,
                }
                music_cache.set(cache_key, res)
                return res
            except Exception as e:
                logger.warning(f"Spotify get_track failed for {track_id}: {e}")

        return None

    GENRE_MAP = {
        "pop": 14,
        "hiphop": 18,
        "dance": 17,
        "rock": 21,
    }

    SPOTIFY_ALL_TIME_HITS = [
        {"title": "Blinding Lights", "artist": "The Weeknd", "query": "The Weeknd Blinding Lights", "genre": "pop"},
        {"title": "Shape of You", "artist": "Ed Sheeran", "query": "Ed Sheeran Shape of You", "genre": "pop"},
        {"title": "Sunflower", "artist": "Post Malone & Swae Lee", "query": "Post Malone Sunflower", "genre": "hip hop"},
        {"title": "As It Was", "artist": "Harry Styles", "query": "Harry Styles As It Was", "genre": "pop"},
        {"title": "Starboy", "artist": "The Weeknd ft. Daft Punk", "query": "The Weeknd Starboy", "genre": "pop"},
        {"title": "Stay", "artist": "The Kid LAROI & Justin Bieber", "query": "The Kid LAROI Stay", "genre": "pop"},
        {"title": "Cruel Summer", "artist": "Taylor Swift", "query": "Taylor Swift Cruel Summer", "genre": "pop"},
        {"title": "Heat Waves", "artist": "Glass Animals", "query": "Glass Animals Heat Waves", "genre": "indie"},
        {"title": "Levitating", "artist": "Dua Lipa", "query": "Dua Lipa Levitating", "genre": "dance"},
        {"title": "Bad Guy", "artist": "Billie Eilish", "query": "Billie Eilish Bad Guy", "genre": "pop"},
        {"title": "Someone You Loved", "artist": "Lewis Capaldi", "query": "Lewis Capaldi Someone You Loved", "genre": "acoustic"},
        {"title": "Flowers", "artist": "Miley Cyrus", "query": "Miley Cyrus Flowers", "genre": "pop"},
        {"title": "One Dance", "artist": "Drake ft. Wizkid", "query": "Drake One Dance", "genre": "hip hop"},
        {"title": "Believer", "artist": "Imagine Dragons", "query": "Imagine Dragons Believer", "genre": "rock"},
        {"title": "Circles", "artist": "Post Malone", "query": "Post Malone Circles", "genre": "pop"},
        {"title": "Watermelon Sugar", "artist": "Harry Styles", "query": "Harry Styles Watermelon Sugar", "genre": "pop"},
        {"title": "drivers license", "artist": "Olivia Rodrigo", "query": "Olivia Rodrigo drivers license", "genre": "pop"},
        {"title": "Don't Start Now", "artist": "Dua Lipa", "query": "Dua Lipa Don't Start Now", "genre": "dance"},
        {"title": "Lucid Dreams", "artist": "Juice WRLD", "query": "Juice WRLD Lucid Dreams", "genre": "hip hop"},
        {"title": "Bohemian Rhapsody", "artist": "Queen", "query": "Queen Bohemian Rhapsody", "genre": "rock"},
    ]

    def get_popular_tracks(self, category: str = "all", limit: int = 20) -> List[Dict[str, Any]]:
        """
        Fetch popular/trending songs referenced from Spotify Global Charts and All-Time Hits.
        Supports category filters ('all', 'spotify_hits', 'charts', 'pop', 'hiphop', 'dance', 'rock').
        """
        cache_key = f"popular:{category.lower()}:{limit}"
        cached = music_cache.get(cache_key)
        if cached is not None:
            return cached

        tracks: List[Dict[str, Any]] = []

        # 1. Spotify All-Time Greatest Hits mode (Sub-millisecond instant load)
        if category in ["all", "spotify_hits"]:
            import os
            import json
            popular_file = os.path.join(
                os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                "utils",
                "popular_data.json"
            )
            if os.path.exists(popular_file):
                try:
                    with open(popular_file, "r", encoding="utf-8") as f:
                        cached_hits = json.load(f)
                    if cached_hits:
                        tracks = cached_hits[:limit]
                        music_cache.set(cache_key, tracks, ttl_seconds=86400)
                        return tracks
                except Exception as e:
                    logger.warning(f"Failed to load popular_data.json: {e}")

            # Parallel fallback if file is not found
            from concurrent.futures import ThreadPoolExecutor

            def _fetch_hit(item):
                results = self.search_tracks(item["query"], limit=1)
                if results:
                    return results[0]
                t_id = f"popular_{item['title'].lower().replace(' ', '_')}"
                feat = _generate_audio_features_profile(t_id, genre=item["genre"])
                return {
                    "spotify_id": t_id,
                    "title": item["title"],
                    "artist": item["artist"],
                    "album": "Top Hits",
                    "duration_ms": 210000,
                    "release_date": "2024-01-01",
                    "preview_url": None,
                    "image_url": None,
                    "youtube_id": None,
                    **feat,
                }

            with ThreadPoolExecutor(max_workers=8) as pool:
                tracks = list(pool.map(_fetch_hit, self.SPOTIFY_ALL_TIME_HITS[:limit]))

            if tracks:
                music_cache.set(cache_key, tracks, ttl_seconds=7200)
                return tracks

        # 2. Live Top Chart Feeds (Global Top 50 & Genre Top Charts)
        try:
            genre_code = self.GENRE_MAP.get(category.lower())
            if genre_code:
                feed_url = f"https://itunes.apple.com/us/rss/topsongs/limit={min(limit, 50)}/genre={genre_code}/json"
            else:
                feed_url = f"https://itunes.apple.com/us/rss/topsongs/limit={min(limit, 50)}/json"

            resp = requests.get(feed_url, timeout=6)
            if resp.status_code == 200:
                data = resp.json()
                entries = data.get("feed", {}).get("entry", [])
                for entry in entries[:limit]:
                    raw_id = entry.get("id", {}).get("attributes", {}).get("im:id", "")
                    track_id = f"itunes_{raw_id}"
                    title = entry.get("im:name", {}).get("label", "Unknown Title")
                    artist = entry.get("im:artist", {}).get("label", "Unknown Artist")
                    album = entry.get("im:collection", {}).get("im:name", {}).get("label")
                    genre = entry.get("category", {}).get("attributes", {}).get("label")
                    release_date = (entry.get("im:releaseDate", {}).get("label", ""))[:10]

                    # Highest resolution artwork
                    images = entry.get("im:image", [])
                    artwork = images[-1].get("label", "") if images else ""
                    if artwork and "170x170bb" in artwork:
                        artwork = artwork.replace("170x170bb", "600x600bb")
                    elif artwork and "100x100bb" in artwork:
                        artwork = artwork.replace("100x100bb", "600x600bb")

                    # Preview audio URL
                    preview_url = None
                    links = entry.get("link", [])
                    if len(links) > 1:
                        preview_url = links[1].get("attributes", {}).get("href")

                    feat = _generate_audio_features_profile(track_id, genre=genre)

                    tracks.append({
                        "spotify_id": track_id,
                        "title": title,
                        "artist": artist,
                        "album": album,
                        "duration_ms": 210000,
                        "release_date": release_date,
                        "preview_url": preview_url,
                        "image_url": artwork,
                        "youtube_id": None,
                        **feat,
                    })

                if tracks:
                    music_cache.set(cache_key, tracks, ttl_seconds=3600)
                    return tracks
        except Exception as e:
            logger.error(f"Failed to fetch live popular tracks for category '{category}': {e}")

        # Fallback to search if RSS fails
        return self.search_tracks(f"top {category} hits", limit=limit)


spotify_service = SpotifyService()
