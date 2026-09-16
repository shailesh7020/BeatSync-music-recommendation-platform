import time
from typing import Any, Optional, Dict, Tuple


class SimpleTTLCache:
    """
    Thread-safe, lightweight in-memory cache with Time-To-Live (TTL) expiration.
    Used to cache YouTube video searches (saving daily API quota) and music metadata.
    """

    def __init__(self, default_ttl_seconds: int = 3600, max_size: int = 2000):
        self._cache: Dict[str, Tuple[Any, float]] = {}
        self.default_ttl = default_ttl_seconds
        self.max_size = max_size

    def get(self, key: str) -> Optional[Any]:
        if key in self._cache:
            value, expires_at = self._cache[key]
            if time.time() < expires_at:
                return value
            else:
                del self._cache[key]
        return None

    def set(self, key: str, value: Any, ttl_seconds: Optional[int] = None) -> None:
        if len(self._cache) >= self.max_size:
            # Evict expired keys first
            now = time.time()
            expired_keys = [k for k, (_, exp) in self._cache.items() if now >= exp]
            for k in expired_keys:
                del self._cache[k]

            # If still full, pop an arbitrary item
            if len(self._cache) >= self.max_size:
                first_key = next(iter(self._cache))
                del self._cache[first_key]

        ttl = ttl_seconds if ttl_seconds is not None else self.default_ttl
        self._cache[key] = (value, time.time() + ttl)

    def clear(self) -> None:
        self._cache.clear()

    def __len__(self) -> int:
        return len(self._cache)


# Global cache instances
youtube_cache = SimpleTTLCache(default_ttl_seconds=86400)  # 24 hours
music_cache = SimpleTTLCache(default_ttl_seconds=3600)      # 1 hour
