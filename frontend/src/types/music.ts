export interface Track {
  id?: number;
  spotify_id: string;
  title: string;
  artist: string;
  album?: string;
  duration_ms?: number;
  release_date?: string;
  preview_url?: string | null;
  image_url?: string | null;
  youtube_id?: string | null;

  // Audio features
  danceability?: number;
  energy?: number;
  tempo?: number;
  valence?: number;
  acousticness?: number;
  loudness?: number;

  // Recommender metadata
  similarity_score?: number;
  explanation?: string;
}

export interface MoodPreset {
  id: string;
  name: string;
  description: string;
}

export interface PlaybackInfo {
  video_id: string;
  title: string;
  channel_title?: string;
  thumbnail_url?: string;
  embed_url: string;
  watch_url: string;
  cached_in_db?: boolean;
}

export interface SearchResponse {
  query: string;
  count: number;
  results: Track[];
}

export interface RecommendationResponse {
  seed_song_id?: string;
  user_id?: number;
  mood?: string;
  count: number;
  recommendations: Track[];
}

export interface PromptPlaylistResponse {
  title: string;
  description: string;
  prompt: string;
  tracks: Track[];
}

export interface RoomState {
  room_id: string;
  current_track: Track | null;
  is_playing: boolean;
  position_sec: number;
  host: string;
  listeners: number;
}

