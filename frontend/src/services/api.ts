import {
  Track,
  MoodPreset,
  PlaybackInfo,
  SearchResponse,
  RecommendationResponse,
  PromptPlaylistResponse,
} from "../types/music";
import { Capacitor } from "@capacitor/core";

const DEFAULT_CLOUD_API = "https://beatsync-backend-jcyl.onrender.com";
const ENV_ORIGIN = import.meta.env.VITE_API_BASE_URL;

// On native Android/iOS mobile devices, requests must target the cloud backend host
const API_ORIGIN = ENV_ORIGIN !== undefined
  ? ENV_ORIGIN
  : (Capacitor.isNativePlatform() ? DEFAULT_CLOUD_API : "");

const BASE_URL = API_ORIGIN ? `${API_ORIGIN.replace(/\/+$/, "")}/api/v1` : "/api/v1";

// In-memory client cache to eliminate redundant network roundtrips
const clientCache = new Map<string, { data: any; expires: number }>();

async function cachedFetch<T>(key: string, ttlMs: number, fetcher: () => Promise<T>): Promise<T> {
  const item = clientCache.get(key);
  if (item && Date.now() < item.expires) {
    return item.data as T;
  }
  const data = await fetcher();
  clientCache.set(key, { data, expires: Date.now() + ttlMs });
  return data;
}

// Background pre-warm to wake up free cloud server immediately upon loading
if (typeof window !== "undefined") {
  fetch(`${BASE_URL}/health`).catch(() => {});
}

export const api = {
  async checkHealth() {
    const res = await fetch(`${BASE_URL}/health`);
    if (!res.ok) throw new Error("Health check failed");
    return res.json();
  },

  async searchMusic(query: string, limit = 12): Promise<SearchResponse> {
    return cachedFetch(`search:${query.toLowerCase().trim()}:${limit}`, 60_000, async () => {
      const res = await fetch(
        `${BASE_URL}/music/search?q=${encodeURIComponent(query)}&limit=${limit}`
      );
      if (!res.ok) throw new Error(`Search failed: ${res.statusText}`);
      return res.json();
    });
  },

  async getPopularTracks(
    category: string = "all",
    limit: number = 20
  ): Promise<{ category: string; count: number; tracks: Track[] }> {
    return cachedFetch(`popular:${category}:${limit}`, 300_000, async () => {
      const res = await fetch(
        `${BASE_URL}/music/popular?category=${encodeURIComponent(category)}&limit=${limit}`
      );
      if (!res.ok) throw new Error("Failed to load popular tracks");
      return res.json();
    });
  },

  async getTrackDetails(spotifyId: string): Promise<Track> {
    return cachedFetch(`track:${spotifyId}`, 600_000, async () => {
      const res = await fetch(`${BASE_URL}/music/track/${encodeURIComponent(spotifyId)}`);
      if (!res.ok) throw new Error(`Failed to load track ${spotifyId}`);
      return res.json();
    });
  },

  async getPlayback(artist: string, title: string, spotifyId?: string): Promise<PlaybackInfo> {
    const key = `playback:${artist.toLowerCase().trim()}:${title.toLowerCase().trim()}:${spotifyId || ""}`;
    return cachedFetch(key, 1_800_000, async () => {
      let url = `${BASE_URL}/music/playback?artist=${encodeURIComponent(artist)}&title=${encodeURIComponent(title)}`;
      if (spotifyId) {
        url += `&spotify_id=${encodeURIComponent(spotifyId)}`;
      }
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Failed to resolve playback`);
      return res.json();
    });
  },

  async getSimilarTracks(songId: string | number, limit = 8): Promise<RecommendationResponse> {
    return cachedFetch(`similar:${songId}:${limit}`, 300_000, async () => {
      const res = await fetch(
        `${BASE_URL}/recommendations/similar/${encodeURIComponent(songId)}?limit=${limit}`
      );
      if (!res.ok) throw new Error(`Failed to fetch similar tracks`);
      return res.json();
    });
  },

  async getMoodRecommendations(mood: string, limit = 12): Promise<RecommendationResponse> {
    return cachedFetch(`mood:${mood.toLowerCase()}:${limit}`, 300_000, async () => {
      const res = await fetch(
        `${BASE_URL}/recommendations/mood?mood=${encodeURIComponent(mood)}&limit=${limit}`
      );
      if (!res.ok) throw new Error(`Failed to fetch ${mood} recommendations`);
      return res.json();
    });
  },

  async getUserRecommendations(userId = 1, limit = 12): Promise<RecommendationResponse> {
    return cachedFetch(`user:${userId}:${limit}`, 120_000, async () => {
      const res = await fetch(
        `${BASE_URL}/recommendations/user/${userId}?limit=${limit}`
      );
      if (!res.ok) throw new Error(`Failed to fetch user recommendations`);
      return res.json();
    });
  },

  async getMoodPresets(): Promise<{ moods: MoodPreset[] }> {
    return cachedFetch("mood_presets", 3_600_000, async () => {
      const res = await fetch(`${BASE_URL}/recommendations/moods`);
      if (!res.ok) throw new Error(`Failed to fetch mood presets`);
      return res.json();
    });
  },

  async generatePromptPlaylist(prompt: string, limit = 12): Promise<PromptPlaylistResponse> {
    const res = await fetch(`${BASE_URL}/recommendations/prompt`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, limit }),
    });
    if (!res.ok) throw new Error(`Failed to generate prompt playlist`);
    return res.json();
  },

  async toggleLike(userId: number, songId: number, rating = 5.0): Promise<{ liked: boolean; message: string }> {
    const res = await fetch(`${BASE_URL}/interactions/like`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, song_id: songId, rating }),
    });
    if (!res.ok) throw new Error(`Failed to toggle like`);
    return res.json();
  },

  async getUserLikedSongIds(userId = 1): Promise<number[]> {
    try {
      const res = await fetch(`${BASE_URL}/interactions/likes/${userId}`);
      if (!res.ok) return [];
      const data = await res.json();
      return data.liked_song_ids || [];
    } catch {
      return [];
    }
  },

  async recordPlay(userId: number, songId: number, durationSec: number, completed = false, skipped = false) {
    try {
      await fetch(`${BASE_URL}/interactions/play`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userId,
          song_id: songId,
          play_duration_sec: durationSec,
          completed,
          skipped,
        }),
      });
    } catch (e) {
      // Background metric; ignore error
    }
  },

  getDownloadSongUrl(
    artist: string,
    title: string,
    youtubeId?: string | null,
    previewUrl?: string | null
  ): string {
    let url = `${BASE_URL}/download/song?artist=${encodeURIComponent(artist)}&title=${encodeURIComponent(title)}`;
    if (youtubeId) {
      url += `&youtube_id=${encodeURIComponent(youtubeId)}`;
    }
    if (previewUrl) {
      url += `&preview_url=${encodeURIComponent(previewUrl)}`;
    }
    return url;
  },

  getStreamSongUrl(
    artist: string,
    title: string,
    youtubeId?: string | null,
    previewUrl?: string | null
  ): string {
    let url = `${BASE_URL}/download/stream?artist=${encodeURIComponent(artist)}&title=${encodeURIComponent(title)}`;
    if (youtubeId) {
      url += `&youtube_id=${encodeURIComponent(youtubeId)}`;
    }
    if (previewUrl) {
      url += `&preview_url=${encodeURIComponent(previewUrl)}`;
    }
    return url;
  },
};



