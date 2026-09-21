import {
  Track,
  MoodPreset,
  PlaybackInfo,
  SearchResponse,
  RecommendationResponse,
  PromptPlaylistResponse,
} from "../types/music";
import { Capacitor } from "@capacitor/core";
import { Preferences } from "@capacitor/preferences";

export const DEFAULT_CLOUD_API = "https://beatsync-backend-jcyl.onrender.com";
export const DEFAULT_LAPTOP_API = "http://192.168.1.189:8000";
const ENV_ORIGIN = import.meta.env.VITE_API_BASE_URL;

export type ServerMode = "auto" | "laptop" | "cloud" | "custom";

export interface BackendInfo {
  origin: string;
  mode: ServerMode;
  isHealthy: boolean | null;
  latencyMs: number | null;
  isLocal: boolean;
}

const PREF_SERVER_MODE = "beatsync_server_mode";
const PREF_CUSTOM_URL = "beatsync_custom_url";

// Initial state
let activeOrigin: string = (() => {
  if (ENV_ORIGIN !== undefined) return ENV_ORIGIN;
  // On native platform, default to laptop Wi-Fi backend for 100% full song downloads
  return Capacitor.isNativePlatform() ? DEFAULT_LAPTOP_API : "";
})();

let activeMode: ServerMode = "auto";
let activeHealth: boolean | null = null;
let activeLatency: number | null = null;

export function getBaseUrl(): string {
  return activeOrigin ? `${activeOrigin.replace(/\/+$/, "")}/api/v1` : "/api/v1";
}

export function getActiveOrigin(): string {
  return activeOrigin;
}

export function getActiveMode(): ServerMode {
  return activeMode;
}

type BackendListener = (info: BackendInfo) => void;
const backendListeners = new Set<BackendListener>();

function notifyBackendListeners() {
  const info: BackendInfo = {
    origin: activeOrigin,
    mode: activeMode,
    isHealthy: activeHealth,
    latencyMs: activeLatency,
    isLocal: activeOrigin.includes("192.168") || activeOrigin.includes("localhost") || activeOrigin === "",
  };
  backendListeners.forEach((fn) => {
    try {
      fn(info);
    } catch (e) {
      console.warn("Backend listener error:", e);
    }
  });
}

export function onBackendChange(listener: BackendListener) {
  backendListeners.add(listener);
  listener({
    origin: activeOrigin,
    mode: activeMode,
    isHealthy: activeHealth,
    latencyMs: activeLatency,
    isLocal: activeOrigin.includes("192.168") || activeOrigin.includes("localhost") || activeOrigin === "",
  });
  return () => {
    backendListeners.delete(listener);
  };
}

async function pingUrl(url: string, timeoutMs = 1500): Promise<{ ok: boolean; latencyMs: number }> {
  const start = performance.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const cleanUrl = url.replace(/\/+$/, "");
    const res = await fetch(`${cleanUrl}/api/v1/health`, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    clearTimeout(timer);
    const latencyMs = Math.round(performance.now() - start);
    return { ok: res.ok, latencyMs };
  } catch {
    clearTimeout(timer);
    return { ok: false, latencyMs: 0 };
  }
}

export async function initBackendConnection(): Promise<BackendInfo> {
  try {
    let savedMode: ServerMode = "auto";
    let savedCustom: string = "";

    try {
      const modePref = await Preferences.get({ key: PREF_SERVER_MODE });
      if (modePref.value) savedMode = modePref.value as ServerMode;
      const customPref = await Preferences.get({ key: PREF_CUSTOM_URL });
      if (customPref.value) savedCustom = customPref.value;
    } catch {
      if (typeof localStorage !== "undefined") {
        savedMode = (localStorage.getItem(PREF_SERVER_MODE) as ServerMode) || "auto";
        savedCustom = localStorage.getItem(PREF_CUSTOM_URL) || "";
      }
    }

    activeMode = savedMode;

    if (savedMode === "laptop") {
      activeOrigin = DEFAULT_LAPTOP_API;
    } else if (savedMode === "cloud") {
      activeOrigin = DEFAULT_CLOUD_API;
    } else if (savedMode === "custom" && savedCustom) {
      activeOrigin = savedCustom;
    } else {
      // Auto mode: test laptop Wi-Fi first for native apps
      if (Capacitor.isNativePlatform()) {
        const laptopPing = await pingUrl(DEFAULT_LAPTOP_API, 1000);
        if (laptopPing.ok) {
          activeOrigin = DEFAULT_LAPTOP_API;
          activeHealth = true;
          activeLatency = laptopPing.latencyMs;
        } else {
          activeOrigin = DEFAULT_CLOUD_API;
        }
      } else {
        if (ENV_ORIGIN !== undefined) {
          activeOrigin = ENV_ORIGIN;
        } else {
          activeOrigin = "";
        }
      }
    }

    // Ping active origin
    const pingTarget = activeOrigin || (typeof window !== "undefined" ? window.location.origin : "");
    if (pingTarget) {
      const ping = await pingUrl(pingTarget, 2000);
      activeHealth = ping.ok;
      activeLatency = ping.latencyMs;
    }
    notifyBackendListeners();
  } catch (e) {
    console.warn("initBackendConnection failed:", e);
  }

  return {
    origin: activeOrigin,
    mode: activeMode,
    isHealthy: activeHealth,
    latencyMs: activeLatency,
    isLocal: activeOrigin.includes("192.168") || activeOrigin.includes("localhost") || activeOrigin === "",
  };
}

// Background startup check
if (typeof window !== "undefined") {
  initBackendConnection();
}

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

export const api = {
  getBaseUrl() {
    return getBaseUrl();
  },

  getActiveOrigin() {
    return getActiveOrigin();
  },

  getActiveMode() {
    return getActiveMode();
  },

  async pingOrigin(origin: string) {
    return pingUrl(origin);
  },

  async switchBackend(mode: ServerMode, customUrl?: string): Promise<BackendInfo> {
    activeMode = mode;
    if (mode === "laptop") {
      activeOrigin = DEFAULT_LAPTOP_API;
    } else if (mode === "cloud") {
      activeOrigin = DEFAULT_CLOUD_API;
    } else if (mode === "custom" && customUrl) {
      activeOrigin = customUrl;
    } else {
      // auto
      if (Capacitor.isNativePlatform()) {
        const laptopPing = await pingUrl(DEFAULT_LAPTOP_API, 1000);
        activeOrigin = laptopPing.ok ? DEFAULT_LAPTOP_API : DEFAULT_CLOUD_API;
      } else {
        activeOrigin = ENV_ORIGIN !== undefined ? ENV_ORIGIN : "";
      }
    }

    try {
      await Preferences.set({ key: PREF_SERVER_MODE, value: mode });
      if (customUrl) {
        await Preferences.set({ key: PREF_CUSTOM_URL, value: customUrl });
      }
    } catch {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(PREF_SERVER_MODE, mode);
        if (customUrl) localStorage.setItem(PREF_CUSTOM_URL, customUrl);
      }
    }

    const pingTarget = activeOrigin || (typeof window !== "undefined" ? window.location.origin : "");
    const ping = await pingUrl(pingTarget, 2500);
    activeHealth = ping.ok;
    activeLatency = ping.latencyMs;
    notifyBackendListeners();
    clientCache.clear();

    return {
      origin: activeOrigin,
      mode: activeMode,
      isHealthy: activeHealth,
      latencyMs: activeLatency,
      isLocal: activeOrigin.includes("192.168") || activeOrigin.includes("localhost") || activeOrigin === "",
    };
  },

  async checkHealth() {
    const res = await fetch(`${getBaseUrl()}/health`);
    if (!res.ok) throw new Error("Health check failed");
    return res.json();
  },

  async searchMusic(query: string, limit = 12): Promise<SearchResponse> {
    return cachedFetch(`search:${query.toLowerCase().trim()}:${limit}`, 60_000, async () => {
      const res = await fetch(
        `${getBaseUrl()}/music/search?q=${encodeURIComponent(query)}&limit=${limit}`
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
        `${getBaseUrl()}/music/popular?category=${encodeURIComponent(category)}&limit=${limit}`
      );
      if (!res.ok) throw new Error("Failed to load popular tracks");
      return res.json();
    });
  },

  async getTrackDetails(spotifyId: string): Promise<Track> {
    return cachedFetch(`track:${spotifyId}`, 600_000, async () => {
      const res = await fetch(`${getBaseUrl()}/music/track/${encodeURIComponent(spotifyId)}`);
      if (!res.ok) throw new Error(`Failed to load track ${spotifyId}`);
      return res.json();
    });
  },

  async getPlayback(artist: string, title: string, spotifyId?: string): Promise<PlaybackInfo> {
    const key = `playback:${artist.toLowerCase().trim()}:${title.toLowerCase().trim()}:${spotifyId || ""}`;
    return cachedFetch(key, 1_800_000, async () => {
      let url = `${getBaseUrl()}/music/playback?artist=${encodeURIComponent(artist)}&title=${encodeURIComponent(title)}`;
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
        `${getBaseUrl()}/recommendations/similar/${encodeURIComponent(songId)}?limit=${limit}`
      );
      if (!res.ok) throw new Error(`Failed to fetch similar tracks`);
      return res.json();
    });
  },

  async getMoodRecommendations(mood: string, limit = 12): Promise<RecommendationResponse> {
    return cachedFetch(`mood:${mood.toLowerCase()}:${limit}`, 300_000, async () => {
      const res = await fetch(
        `${getBaseUrl()}/recommendations/mood?mood=${encodeURIComponent(mood)}&limit=${limit}`
      );
      if (!res.ok) throw new Error(`Failed to fetch ${mood} recommendations`);
      return res.json();
    });
  },

  async getUserRecommendations(userId = 1, limit = 12): Promise<RecommendationResponse> {
    return cachedFetch(`user:${userId}:${limit}`, 120_000, async () => {
      const res = await fetch(
        `${getBaseUrl()}/recommendations/user/${userId}?limit=${limit}`
      );
      if (!res.ok) throw new Error(`Failed to fetch user recommendations`);
      return res.json();
    });
  },

  async getMoodPresets(): Promise<{ moods: MoodPreset[] }> {
    return cachedFetch("mood_presets", 3_600_000, async () => {
      const res = await fetch(`${getBaseUrl()}/recommendations/moods`);
      if (!res.ok) throw new Error(`Failed to fetch mood presets`);
      return res.json();
    });
  },

  async generatePromptPlaylist(prompt: string, limit = 12): Promise<PromptPlaylistResponse> {
    const res = await fetch(`${getBaseUrl()}/recommendations/prompt`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, limit }),
    });
    if (!res.ok) throw new Error(`Failed to generate prompt playlist`);
    return res.json();
  },

  async toggleLike(userId: number, songId: number, rating = 5.0): Promise<{ liked: boolean; message: string }> {
    const res = await fetch(`${getBaseUrl()}/interactions/like`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, song_id: songId, rating }),
    });
    if (!res.ok) throw new Error(`Failed to toggle like`);
    return res.json();
  },

  async getUserLikedSongIds(userId = 1): Promise<number[]> {
    try {
      const res = await fetch(`${getBaseUrl()}/interactions/likes/${userId}`);
      if (!res.ok) return [];
      const data = await res.json();
      return data.liked_song_ids || [];
    } catch {
      return [];
    }
  },

  async recordPlay(userId: number, songId: number, durationSec: number, completed = false, skipped = false) {
    try {
      await fetch(`${getBaseUrl()}/interactions/play`, {
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
    let url = `${getBaseUrl()}/download/song?artist=${encodeURIComponent(artist)}&title=${encodeURIComponent(title)}`;
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
    let url = `${getBaseUrl()}/download/stream?artist=${encodeURIComponent(artist)}&title=${encodeURIComponent(title)}`;
    if (youtubeId) {
      url += `&youtube_id=${encodeURIComponent(youtubeId)}`;
    }
    if (previewUrl) {
      url += `&preview_url=${encodeURIComponent(previewUrl)}`;
    }
    return url;
  },
};
