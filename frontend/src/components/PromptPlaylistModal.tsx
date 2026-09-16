import React, { useState } from "react";
import { Sparkles, X, Wand2, Play, Pause, Youtube, Disc3, Loader2 } from "lucide-react";
import { Track, PromptPlaylistResponse } from "../types/music";
import { api } from "../services/api";

interface PromptPlaylistModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPlay: (track: Track) => void;
  onWatchVideo: (track: Track) => void;
  onLoadPlaylistToMain: (tracks: Track[], title: string) => void;
  currentTrack: Track | null;
  isPlaying: boolean;
}

const SUGGESTIONS = [
  "Midnight rainy drive with chill lo-fi beats",
  "High intensity gym workout with heavy bass and fast tempo",
  "Sunday morning acoustic coffee shop jazz",
  "Cyberpunk synthwave electronic party",
  "Joyful sunny summer road trip feel good",
  "Deep emotional acoustic piano and soft strings",
];

export const PromptPlaylistModal: React.FC<PromptPlaylistModalProps> = ({
  isOpen,
  onClose,
  onPlay,
  onWatchVideo,
  onLoadPlaylistToMain,
  currentTrack,
  isPlaying,
}) => {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PromptPlaylistResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleGenerate = async (promptText: string) => {
    if (!promptText.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api.generatePromptPlaylist(promptText, 10);
      setResult(data);
    } catch (err: any) {
      setError(err.message || "Failed to generate playlist from prompt");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl max-h-[85vh] bg-spotify-surface border border-emerald-500/30 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-spotify-divider flex items-center justify-between bg-gradient-to-r from-emerald-950/50 to-zinc-900/50">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-spotify-green/20 border border-spotify-green/40 flex items-center justify-center text-spotify-green">
              <Wand2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-extrabold text-lg text-white flex items-center gap-1.5">
                <span>AI Prompt-to-Playlist</span>
                <span className="px-2 py-0.5 rounded-full bg-spotify-green/20 text-spotify-green text-[10px] font-bold">
                  NLP Vibe Engine
                </span>
              </h2>
              <p className="text-xs text-spotify-muted">
                Describe the vibe, scene, or activity in plain language
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-spotify-card hover:bg-zinc-800 flex items-center justify-center text-spotify-muted hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Input & Prompt Suggestions */}
        <div className="p-5 border-b border-spotify-divider/60 bg-zinc-900/30">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleGenerate(prompt);
            }}
            className="flex gap-2"
          >
            <input
              type="text"
              placeholder="e.g. 'Late night neon Tokyo drive with dark synthwave'..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="flex-1 px-4 py-2.5 bg-spotify-card border border-spotify-divider rounded-xl text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-spotify-green"
            />
            <button
              type="submit"
              disabled={loading || !prompt.trim()}
              className="px-5 py-2.5 rounded-xl bg-spotify-green text-black font-extrabold text-xs hover:bg-spotify-greenHover disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 shadow-lg shadow-spotify-green/20"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              <span>Generate</span>
            </button>
          </form>

          {/* Preset Suggestions */}
          <div className="mt-3 flex flex-wrap gap-1.5">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => {
                  setPrompt(s);
                  handleGenerate(s);
                }}
                className="px-2.5 py-1 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 text-[11px] text-zinc-300 border border-white/5 hover:border-spotify-green/40 transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Results Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3 text-spotify-muted">
              <Loader2 className="w-9 h-9 animate-spin text-spotify-green" />
              <p className="text-xs font-semibold">Extracting emotional valence and vector dimensions...</p>
            </div>
          ) : error ? (
            <div className="py-12 text-center text-red-400 text-sm">{error}</div>
          ) : result ? (
            <div>
              {/* Generated Playlist Info Bar */}
              <div className="mb-4 p-4 rounded-xl bg-gradient-to-r from-emerald-900/30 to-spotify-card border border-emerald-500/20 flex items-center justify-between gap-4">
                <div>
                  <h3 className="font-extrabold text-base text-white">{result.title}</h3>
                  <p className="text-xs text-zinc-400 mt-0.5">{result.description}</p>
                </div>
                <button
                  onClick={() => {
                    onLoadPlaylistToMain(result.tracks, result.title);
                    onClose();
                  }}
                  className="px-3.5 py-1.5 rounded-lg bg-spotify-green hover:bg-spotify-greenHover text-black text-xs font-extrabold flex items-center gap-1.5 shadow"
                >
                  <Play className="w-3.5 h-3.5 fill-black" />
                  <span>Load into Dashboard</span>
                </button>
              </div>

              {/* Track list */}
              <div className="space-y-2">
                {result.tracks.map((track) => {
                  const isCurr = currentTrack?.spotify_id === track.spotify_id;
                  return (
                    <div
                      key={track.spotify_id}
                      className="p-2.5 rounded-xl bg-spotify-card/60 hover:bg-spotify-card border border-white/5 flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="w-10 h-10 rounded-md overflow-hidden bg-zinc-800 flex-shrink-0">
                          {track.image_url ? (
                            <img src={track.image_url} alt={track.title} className="w-full h-full object-cover" />
                          ) : (
                            <Disc3 className="w-5 h-5 text-zinc-600 m-2.5" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4 className="font-bold text-xs text-white truncate">{track.title}</h4>
                          <p className="text-[11px] text-spotify-muted truncate">{track.artist}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {track.similarity_score && (
                          <span className="text-[10px] font-bold text-spotify-green px-2 py-0.5 rounded-full bg-spotify-green/10">
                            {track.similarity_score}%
                          </span>
                        )}

                        <button
                          onClick={() => onPlay(track)}
                          className={`w-8 h-8 rounded-full flex items-center justify-center ${
                            isCurr && isPlaying ? "bg-white text-black" : "bg-spotify-green text-black"
                          }`}
                        >
                          {isCurr && isPlaying ? (
                            <Pause className="w-3.5 h-3.5 fill-black" />
                          ) : (
                            <Play className="w-3.5 h-3.5 fill-black ml-0.5" />
                          )}
                        </button>

                        <button
                          onClick={() => onWatchVideo(track)}
                          className="p-1.5 rounded-lg bg-red-600/10 hover:bg-red-600/20 text-red-400"
                          title="Stream on YouTube"
                        >
                          <Youtube className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="py-20 text-center text-spotify-muted text-xs">
              Type any descriptive prompt above or click one of the suggested vibes.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
