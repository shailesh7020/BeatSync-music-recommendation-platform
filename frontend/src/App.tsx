import React, { useState, useEffect, useCallback, useRef } from "react";
import { Loader2, Music, Sparkles, AlertCircle, Flame } from "lucide-react";
import { Track } from "./types/music";
import { api } from "./services/api";
import { Navbar } from "./components/Navbar";
import { CombinedFilterSelector } from "./components/CombinedFilterSelector";
import { TrackCard } from "./components/TrackCard";
import { SimilarTracksModal } from "./components/SimilarTracksModal";
import { PlayerBar } from "./components/PlayerBar";
import { PromptPlaylistModal } from "./components/PromptPlaylistModal";
import { SocialRoomDrawer } from "./components/SocialRoomDrawer";

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<"popular" | "moods" | "foryou" | "search">("popular");
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [isMood, setIsMood] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [customTitle, setCustomTitle] = useState<string | null>(null);

  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Likes state
  const [likedSongIds, setLikedSongIds] = useState<Set<number>>(new Set());

  // Playback State
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [showVideo, setShowVideo] = useState<boolean>(false);

  // Modal & Drawer State
  const [similarModalTrack, setSimilarModalTrack] = useState<Track | null>(null);
  const [isPromptModalOpen, setIsPromptModalOpen] = useState<boolean>(false);
  const [isSocialRoomOpen, setIsSocialRoomOpen] = useState<boolean>(false);

  // Load liked song IDs on mount
  useEffect(() => {
    api.getUserLikedSongIds(1).then((ids) => {
      setLikedSongIds(new Set(ids));
    });
  }, []);

  // Fetch tracks according to active view
  const fetchTracks = useCallback(async () => {
    setLoading(true);
    setError(null);
    setCustomTitle(null);
    try {
      if (activeTab === "search") {
        if (searchQuery.trim().length > 0) {
          const res = await api.searchMusic(searchQuery, 16);
          setTracks(res.results);
        } else {
          setTracks([]);
        }
      } else if (activeTab === "foryou") {
        const res = await api.getUserRecommendations(1, 16);
        setTracks(res.recommendations);
      } else {
        // Combined Hits & Moods Tab (default discovery view)
        if (isMood) {
          const res = await api.getMoodRecommendations(activeCategory, 20);
          setTracks(res.recommendations);
        } else {
          const res = await api.getPopularTracks(activeCategory, 20);
          setTracks(res.tracks);
        }
      }
    } catch (err: any) {
      setError(err.message || "Failed to load music recommendations");
    } finally {
      setLoading(false);
    }
  }, [activeTab, activeCategory, isMood, searchQuery]);

  useEffect(() => {
    fetchTracks();
  }, [fetchTracks]);

  // Debounced search trigger
  useEffect(() => {
    if (activeTab === "search") {
      const timer = setTimeout(() => {
        fetchTracks();
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [searchQuery, activeTab, fetchTracks]);

  const handlePlayTrack = (track: Track) => {
    if (currentTrack?.spotify_id === track.spotify_id) {
      setIsPlaying(!isPlaying);
    } else {
      setCurrentTrack(track);
      setIsPlaying(true);
      // Log play interaction
      if (track.id) {
        api.recordPlay(1, track.id, 30.0, true, false);
      }
    }
  };

  const handleWatchVideo = (track: Track) => {
    setCurrentTrack(track);
    setIsPlaying(true);
    setShowVideo(true);
    if (track.id) {
      api.recordPlay(1, track.id, 60.0, true, false);
    }
  };

  const handleToggleLike = async (track: Track) => {
    if (!track.id) return;
    try {
      const res = await api.toggleLike(1, track.id);
      setLikedSongIds((prev) => {
        const updated = new Set(prev);
        if (res.liked) {
          updated.add(track.id!);
        } else {
          updated.delete(track.id!);
        }
        return updated;
      });
    } catch (e) {
      // ignore
    }
  };

  const handleLoadPlaylistToMain = (playlistTracks: Track[], title: string) => {
    setTracks(playlistTracks);
    setCustomTitle(title);
  };

  // Robust refs to eliminate stale closure bugs during auto-play
  const tracksRef = useRef<Track[]>(tracks);
  tracksRef.current = tracks;
  const currentTrackRef = useRef<Track | null>(currentTrack);
  currentTrackRef.current = currentTrack;

  const handleNext = useCallback(() => {
    const list = tracksRef.current;
    const current = currentTrackRef.current;
    if (list.length === 0) return;
    let nextIndex = 0;
    if (current) {
      const idx = list.findIndex((t) => t.spotify_id === current.spotify_id);
      if (idx !== -1) {
        nextIndex = (idx + 1) % list.length;
      }
    }
    const nextTrack = list[nextIndex];
    if (nextTrack) {
      setCurrentTrack(nextTrack);
      setIsPlaying(true);
      if (nextTrack.id) {
        api.recordPlay(1, nextTrack.id, 0, false, false);
      }
    }
  }, []);

  const handlePrev = useCallback(() => {
    const list = tracksRef.current;
    const current = currentTrackRef.current;
    if (list.length === 0) return;
    let prevIndex = 0;
    if (current) {
      const idx = list.findIndex((t) => t.spotify_id === current.spotify_id);
      if (idx !== -1) {
        prevIndex = (idx - 1 + list.length) % list.length;
      }
    }
    const prevTrack = list[prevIndex];
    if (prevTrack) {
      setCurrentTrack(prevTrack);
      setIsPlaying(true);
    }
  }, []);

  return (
    <div className="min-h-screen bg-spotify-black text-white flex flex-col pb-28">
      <Navbar
        searchQuery={searchQuery}
        onSearchChange={(q) => setSearchQuery(q)}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenPromptModal={() => setIsPromptModalOpen(true)}
        onOpenSocialRoom={() => setIsSocialRoomOpen(true)}
      />

      <main className="max-w-7xl mx-auto px-6 pt-6 flex-1 w-full">
        {/* Banner */}
        <div className="mb-8 p-6 rounded-2xl bg-gradient-to-r from-emerald-900/40 via-zinc-900/80 to-spotify-card border border-emerald-500/20 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-spotify-green text-xs font-bold uppercase tracking-wider mb-1">
              {activeTab === "foryou" ? (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Personalized Machine Learning Profile</span>
                </>
              ) : isMood ? (
                <>
                  <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-300">Acoustic Vector Cosine Match</span>
                </>
              ) : (
                <>
                  <Flame className="w-3.5 h-3.5 text-amber-400" />
                  <span className="text-amber-300">Spotify Global Charts & Hits</span>
                </>
              )}
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              {customTitle
                ? customTitle
                : activeTab === "search"
                ? `Results for "${searchQuery || "..."}"`
                : activeTab === "foryou"
                ? "Your Personalized Daily Taste Profile"
                : isMood
                ? `Vibe: ${activeCategory.charAt(0).toUpperCase() + activeCategory.slice(1)} Session`
                : activeCategory === "all"
                ? "World's Most Popular Tracks"
                : activeCategory === "charts"
                ? "Global Top 50 Daily Hits"
                : `Top ${activeCategory.toUpperCase()} Hits`}
            </h1>
            <p className="text-xs sm:text-sm text-zinc-400 mt-1">
              {customTitle
                ? "AI-generated playlist synthesized from your descriptive prompt."
                : activeTab === "search"
                ? "Search catalogs, listen to 30-sec previews, and discover similar tracks."
                : activeTab === "foryou"
                ? "Dynamically learned from your favorites (❤️) and listening duration."
                : isMood
                ? "Tailored continuous feature vector matching for your current activity."
                : "Real-time trending charts and Spotify all-time streaming records with high-fidelity playback & AI similarity matching."}
            </p>
          </div>
        </div>

        {/* Combined Hits & Moods Selector directly on the front discovery page */}
        {(activeTab === "popular" || activeTab === "moods") && !customTitle && (
          <CombinedFilterSelector
            activeId={activeCategory}
            isMood={isMood}
            onSelectPopular={(cat) => {
              setActiveCategory(cat);
              setIsMood(false);
            }}
            onSelectMood={(mood) => {
              setActiveCategory(mood);
              setIsMood(true);
            }}
          />
        )}

        {/* Content Section */}
        {loading ? (
          <div className="py-24 flex flex-col items-center justify-center gap-3 text-spotify-muted">
            <Loader2 className="w-9 h-9 animate-spin text-spotify-green" />
            <p className="text-sm font-medium">Scoring music catalog with vector similarity...</p>
          </div>
        ) : error ? (
          <div className="py-16 flex flex-col items-center justify-center gap-2 text-center text-red-400">
            <AlertCircle className="w-8 h-8" />
            <p className="text-sm">{error}</p>
            <button
              onClick={fetchTracks}
              className="mt-2 px-4 py-1.5 rounded-full bg-spotify-surface hover:bg-zinc-800 text-xs font-semibold text-white border border-white/10"
            >
              Retry
            </button>
          </div>
        ) : tracks.length === 0 ? (
          <div className="py-24 text-center text-spotify-muted">
            <Music className="w-12 h-12 mx-auto mb-2 opacity-40" />
            <p className="text-sm">No tracks found. Try searching for an artist or choosing a mood.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 gap-4">
            {tracks.map((track) => (
              <TrackCard
                key={track.spotify_id}
                track={track}
                isPlaying={isPlaying}
                isCurrent={currentTrack?.spotify_id === track.spotify_id}
                isLiked={track.id ? likedSongIds.has(track.id) : false}
                onPlay={handlePlayTrack}
                onFindSimilar={(t) => setSimilarModalTrack(t)}
                onWatchVideo={handleWatchVideo}
                onToggleLike={handleToggleLike}
              />
            ))}
          </div>
        )}
      </main>

      {/* Similar Songs Modal */}
      <SimilarTracksModal
        seedTrack={similarModalTrack}
        onClose={() => setSimilarModalTrack(null)}
        onPlay={handlePlayTrack}
        onWatchVideo={handleWatchVideo}
        currentTrack={currentTrack}
        isPlaying={isPlaying}
      />

      {/* AI Prompt Playlist Modal */}
      <PromptPlaylistModal
        isOpen={isPromptModalOpen}
        onClose={() => setIsPromptModalOpen(false)}
        onPlay={handlePlayTrack}
        onWatchVideo={handleWatchVideo}
        onLoadPlaylistToMain={handleLoadPlaylistToMain}
        currentTrack={currentTrack}
        isPlaying={isPlaying}
      />

      {/* Social Jam Room Drawer */}
      <SocialRoomDrawer
        isOpen={isSocialRoomOpen}
        onClose={() => setIsSocialRoomOpen(false)}
        onSyncPlay={handlePlayTrack}
        currentTrack={currentTrack}
      />

      {/* Persistent Audio Player Bar */}
      <PlayerBar
        currentTrack={currentTrack}
        isPlaying={isPlaying}
        onTogglePlay={() => setIsPlaying(!isPlaying)}
        onPlayStateChange={(playing) => setIsPlaying(playing)}
        onNext={handleNext}
        onPrev={handlePrev}
        showVideo={showVideo}
        onToggleShowVideo={(show) => setShowVideo(show)}
      />
    </div>
  );
};
