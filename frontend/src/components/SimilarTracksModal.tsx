import React, { useEffect, useState } from "react";
import { X, Sparkles, Play, Pause, Youtube, Disc3, Loader2 } from "lucide-react";
import { Track } from "../types/music";
import { api } from "../services/api";

interface SimilarTracksModalProps {
  seedTrack: Track | null;
  onClose: () => void;
  onPlay: (track: Track) => void;
  onWatchVideo: (track: Track) => void;
  currentTrack: Track | null;
  isPlaying: boolean;
}

export const SimilarTracksModal: React.FC<SimilarTracksModalProps> = ({
  seedTrack,
  onClose,
  onPlay,
  onWatchVideo,
  currentTrack,
  isPlaying,
}) => {
  const [loading, setLoading] = useState(true);
  const [similarTracks, setSimilarTracks] = useState<Track[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!seedTrack) return;
    setLoading(true);
    setError(null);

    const identifier = seedTrack.id || seedTrack.spotify_id;
    api.getSimilarTracks(identifier, 8)
      .then((res) => {
        setSimilarTracks(res.recommendations);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || "Failed to load similar tracks");
        setLoading(false);
      });
  }, [seedTrack]);

  if (!seedTrack) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl max-h-[85vh] bg-spotify-surface border border-spotify-divider rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="p-5 border-b border-spotify-divider flex items-center justify-between bg-zinc-900/50">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg overflow-hidden bg-zinc-800 flex-shrink-0 shadow">
              {seedTrack.image_url ? (
                <img src={seedTrack.image_url} alt={seedTrack.title} className="w-full h-full object-cover" />
              ) : (
                <Disc3 className="w-6 h-6 text-zinc-600 m-3" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-spotify-green flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  AI Acoustic Lookalikes
                </span>
              </div>
              <h2 className="font-extrabold text-lg text-white leading-tight">{seedTrack.title}</h2>
              <p className="text-xs text-spotify-muted">Similar to this track by {seedTrack.artist}</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-spotify-card hover:bg-zinc-800 flex items-center justify-center text-spotify-muted hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center gap-3 text-spotify-muted">
              <Loader2 className="w-8 h-8 animate-spin text-spotify-green" />
              <p className="text-xs">Computing multidimensional cosine similarity vectors...</p>
            </div>
          ) : error ? (
            <div className="py-12 text-center text-red-400 text-sm">
              <p>{error}</p>
            </div>
          ) : similarTracks.length === 0 ? (
            <div className="py-12 text-center text-spotify-muted text-sm">
              <p>No similar tracks found in catalog yet.</p>
            </div>
          ) : (
            similarTracks.map((track) => {
              const isCurr = currentTrack?.spotify_id === track.spotify_id;
              return (
                <div
                  key={track.spotify_id}
                  className="p-3 rounded-xl bg-spotify-card/60 hover:bg-spotify-card border border-white/5 hover:border-spotify-divider flex items-center justify-between gap-3 transition-all"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="relative w-12 h-12 rounded-md overflow-hidden bg-zinc-800 flex-shrink-0">
                      {track.image_url ? (
                        <img src={track.image_url} alt={track.title} className="w-full h-full object-cover" />
                      ) : (
                        <Disc3 className="w-6 h-6 text-zinc-600 m-3" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-sm text-white truncate">{track.title}</h4>
                        {track.similarity_score && (
                          <span className="px-2 py-0.5 rounded-full bg-spotify-green/20 text-spotify-green font-extrabold text-[10px]">
                            {track.similarity_score}% Match
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-spotify-muted truncate">{track.artist}</p>
                      {track.explanation && (
                        <p className="text-[11px] text-zinc-400 mt-0.5 line-clamp-1">
                          💡 {track.explanation}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onPlay(track)}
                      className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${
                        isCurr && isPlaying
                          ? "bg-white text-black"
                          : "bg-spotify-green hover:scale-105 text-black"
                      }`}
                      title={isCurr && isPlaying ? "Pause preview" : "Play preview"}
                    >
                      {isCurr && isPlaying ? (
                        <Pause className="w-4 h-4 fill-black" />
                      ) : (
                        <Play className="w-4 h-4 fill-black ml-0.5" />
                      )}
                    </button>

                    <button
                      onClick={() => onWatchVideo(track)}
                      className="p-2 rounded-lg bg-red-600/10 hover:bg-red-600/20 text-red-400 hover:text-red-300 transition-colors"
                      title="Stream full video on YouTube"
                    >
                      <Youtube className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
