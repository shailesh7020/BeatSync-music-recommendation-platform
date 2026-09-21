import React, { useState, useEffect } from "react";
import { Play, Pause, Sparkles, Youtube, Disc3, Heart, Download, Share2, Check, Loader2 } from "lucide-react";
import { Track } from "../types/music";
import { api } from "../services/api";
import { shareMedia, downloadTrackToDevice, isTrackDownloaded } from "../services/mobile";


interface TrackCardProps {
  track: Track;
  isPlaying: boolean;
  isCurrent: boolean;
  isLiked?: boolean;
  onPlay: (track: Track) => void;
  onFindSimilar: (track: Track) => void;
  onWatchVideo: (track: Track) => void;
  onToggleLike?: (track: Track) => void;
}

export const TrackCard: React.FC<TrackCardProps> = ({
  track,
  isPlaying,
  isCurrent,
  isLiked = false,
  onPlay,
  onFindSimilar,
  onWatchVideo,
  onToggleLike,
}) => {
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const [isSavedOffline, setIsSavedOffline] = useState<boolean>(false);
  const [downloadMsg, setDownloadMsg] = useState<string | null>(null);

  useEffect(() => {
    isTrackDownloaded(track.id || track.spotify_id).then(setIsSavedOffline);
  }, [track.id, track.spotify_id]);

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setIsDownloading(true);
    const downloadUrl = api.getDownloadSongUrl(track.artist, track.title, track.youtube_id, track.preview_url);
    const res = await downloadTrackToDevice(track, downloadUrl);
    setIsDownloading(false);
    setDownloadMsg(res.message);
    if (res.success) {
      setIsSavedOffline(true);
    }
    setTimeout(() => {
      setDownloadMsg(null);
    }, 4500);
  };

  const energyPercent = Math.round((track.energy || 0.5) * 100);
  const dancePercent = Math.round((track.danceability || 0.5) * 100);
  const valencePercent = Math.round((track.valence || 0.5) * 100);

  return (
    <div
      onClick={() => onPlay(track)}
      className="group relative bg-spotify-surface/80 hover:bg-spotify-card p-3.5 rounded-xl border border-spotify-divider/60 hover:border-spotify-divider transition-all duration-300 hover:shadow-xl hover:shadow-black/60 flex flex-col justify-between cursor-pointer"
    >
      <div>
        {/* Cover Art Container */}
        <div
          className="relative aspect-square w-full rounded-lg overflow-hidden mb-3 bg-zinc-900 shadow-md"
        >
          {track.image_url ? (
            <img
              src={track.image_url}
              alt={track.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-zinc-800 to-zinc-900">
              <Disc3 className="w-12 h-12 text-zinc-600 animate-spin-slow" />
            </div>
          )}

          {/* Like Button */}
          {onToggleLike && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleLike(track);
              }}
              className={`absolute top-2 right-2 p-1.5 rounded-full backdrop-blur-md transition-all z-10 ${
                isLiked
                  ? "bg-black/70 text-spotify-green"
                  : "bg-black/50 text-white/70 hover:text-white hover:scale-110"
              }`}
              title={isLiked ? "Unlike" : "Like song"}
            >
              <Heart className={`w-3.5 h-3.5 ${isLiked ? "fill-spotify-green" : ""}`} />
            </button>
          )}

          {/* Similarity Match Badge */}
          {track.similarity_score !== undefined && (
            <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-black/80 backdrop-blur-md border border-spotify-green/40 text-[10px] font-extrabold text-spotify-green flex items-center gap-1 shadow z-10">
              <Sparkles className="w-2.5 h-2.5" />
              <span>{track.similarity_score}% Match</span>
            </div>
          )}

          {/* Play Button - always visible on mobile, hover-revealed on desktop */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onPlay(track);
            }}
            className={`absolute bottom-2.5 right-2.5 w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-spotify-green flex items-center justify-center shadow-lg shadow-black/60 transition-all duration-200 transform z-10 ${
              isCurrent && isPlaying
                ? "scale-100 opacity-100 bg-white"
                : "opacity-90 sm:opacity-0 sm:translate-y-2 sm:group-hover:opacity-100 sm:group-hover:translate-y-0 hover:scale-110"
            }`}
            title={isCurrent && isPlaying ? "Pause" : "Play Full Song"}
          >
            {isCurrent && isPlaying ? (
              <Pause className="w-4 h-4 sm:w-5 sm:h-5 text-black fill-black" />
            ) : (
              <Play className="w-4 h-4 sm:w-5 sm:h-5 text-black fill-black ml-0.5" />
            )}
          </button>
        </div>

        {/* Track Title & Artist */}
        <h3 className="font-bold text-sm text-white truncate group-hover:text-spotify-green transition-colors" title={track.title}>
          {track.title}
        </h3>
        <p className="text-xs text-spotify-muted truncate mt-0.5" title={track.artist}>
          {track.artist}
        </p>

        {/* Recommender Explanation if present */}
        {track.explanation && (
          <p className="mt-2 text-[11px] text-zinc-400 leading-tight bg-black/30 p-1.5 rounded border border-white/5 line-clamp-2">
            💡 {track.explanation}
          </p>
        )}

        {/* Audio Feature Meters */}
        <div className="mt-3 pt-2.5 border-t border-spotify-divider/40 grid grid-cols-3 gap-1.5 text-[10px]">
          <div>
            <div className="flex justify-between text-zinc-400 mb-0.5">
              <span>Energy</span>
              <span className="font-semibold">{energyPercent}%</span>
            </div>
            <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
              <div className="h-full bg-orange-400 rounded-full" style={{ width: `${energyPercent}%` }} />
            </div>
          </div>

          <div>
            <div className="flex justify-between text-zinc-400 mb-0.5">
              <span>Rhythm</span>
              <span className="font-semibold">{dancePercent}%</span>
            </div>
            <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
              <div className="h-full bg-purple-400 rounded-full" style={{ width: `${dancePercent}%` }} />
            </div>
          </div>

          <div>
            <div className="flex justify-between text-zinc-400 mb-0.5">
              <span>Mood</span>
              <span className="font-semibold">{valencePercent}%</span>
            </div>
            <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
              <div className="h-full bg-spotify-green rounded-full" style={{ width: `${valencePercent}%` }} />
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="mt-3.5 pt-2 flex items-center justify-between gap-1.5"
      >
        <button
          onClick={() => onFindSimilar(track)}
          className="flex-1 py-1.5 px-2 rounded-lg bg-spotify-surface hover:bg-zinc-800 border border-spotify-divider/80 text-[11px] font-medium text-zinc-300 hover:text-white flex items-center justify-center gap-1.5 transition-colors"
          title="Find similar tracks using AI cosine vector matching"
        >
          <Sparkles className="w-3 h-3 text-spotify-green" />
          <span>Similar</span>
        </button>

        <button
          onClick={() => onWatchVideo(track)}
          className="py-1.5 px-2 rounded-lg bg-red-600/10 hover:bg-red-600/20 border border-red-500/20 text-[11px] font-medium text-red-400 hover:text-red-300 flex items-center justify-center gap-1 transition-colors"
          title="Watch official music video"
        >
          <Youtube className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Video</span>
        </button>

        <button
          onClick={() => {
            const url = `https://beatsync-music.web.app/?track=${encodeURIComponent(track.spotify_id)}`;
            shareMedia(
              `${track.title} by ${track.artist}`,
              `Check out "${track.title}" by ${track.artist} on BeatSync AI Music!`,
              url
            );
          }}
          className="py-1.5 px-2 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 border border-zinc-700/60 text-[11px] font-medium text-zinc-400 hover:text-white flex items-center justify-center transition-colors"
          title="Share song via native share sheet"
        >
          <Share2 className="w-3.5 h-3.5" />
        </button>

        <div className="relative">
          <button
            onClick={handleDownload}
            disabled={isDownloading}
            className={`py-1.5 px-2 rounded-lg border text-[11px] font-medium flex items-center justify-center gap-1 transition-colors ${
              isSavedOffline
                ? "bg-emerald-600/30 border-emerald-500/50 text-emerald-300 shadow-sm"
                : "bg-emerald-600/10 hover:bg-emerald-600/20 border border-emerald-500/20 text-emerald-400 hover:text-emerald-300"
            }`}
            title={isSavedOffline ? "Saved on device for offline play" : "Download song to your device for offline play"}
          >
            {isDownloading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
            ) : isSavedOffline ? (
              <Check className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Download className="w-3.5 h-3.5" />
            )}
          </button>

          {downloadMsg && (
            <div className="absolute bottom-full right-0 mb-2 w-52 p-2 bg-zinc-950/95 border border-emerald-500/50 text-emerald-300 text-[10px] leading-tight rounded-xl shadow-2xl z-30 pointer-events-none animate-fade-in backdrop-blur-md">
              {downloadMsg}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

