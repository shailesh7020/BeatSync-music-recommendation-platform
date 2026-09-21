import React, { useRef, useState, useEffect } from "react";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Youtube,
  Disc3,
  X,
  ExternalLink,
  Download,
  Radio,
  Tv,
  Loader2,
  Repeat,
} from "lucide-react";
import { Track } from "../types/music";
import { api } from "../services/api";

interface PlayerBarProps {
  currentTrack: Track | null;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onPlayStateChange?: (playing: boolean) => void;
  onNext: () => void;
  onPrev: () => void;
  showVideo: boolean;
  onToggleShowVideo: (show: boolean) => void;
}

export const PlayerBar: React.FC<PlayerBarProps> = ({
  currentTrack,
  isPlaying,
  onTogglePlay,
  onPlayStateChange,
  onNext,
  onPrev,
  showVideo,
  onToggleShowVideo,
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ytPlayerRef = useRef<any>(null);

  // Stable callback ref to eliminate stale closure in YouTube IFrame event listener
  const onNextRef = useRef(onNext);
  useEffect(() => {
    onNextRef.current = onNext;
  }, [onNext]);

  // Autoplay next song state (ON by default)
  const [isAutoplay, setIsAutoplay] = useState<boolean>(true);
  const isAutoplayRef = useRef<boolean>(true);
  useEffect(() => {
    isAutoplayRef.current = isAutoplay;
  }, [isAutoplay]);

  const autoAdvanceTriggeredRef = useRef<boolean>(false);
  const pendingVideoIdRef = useRef<string | null>(null);

  const [playMode, setPlayMode] = useState<"full" | "preview">("full");
  const [currentVideoId, setCurrentVideoId] = useState<string | null>(null);
  const [isResolving, setIsResolving] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(30);
  const [volume, setVolume] = useState<number>(0.85);
  const [isMuted, setIsMuted] = useState<boolean>(false);

  // Initialize YouTube Iframe Player
  useEffect(() => {
    const initPlayer = () => {
      if (!window.YT || !window.YT.Player) return;
      if (ytPlayerRef.current) return;

      try {
        ytPlayerRef.current = new window.YT.Player("youtube-embed-player", {
          height: "100%",
          width: "100%",
          videoId: "",
          playerVars: {
            autoplay: 1,
            controls: 1,
            modestbranding: 1,
            rel: 0,
            playsinline: 1,
            enablejsapi: 1,
          },
          events: {
            onReady: (event: any) => {
              event.target.setVolume(volume * 100);
              if (pendingVideoIdRef.current) {
                event.target.loadVideoById(pendingVideoIdRef.current);
                if (isPlaying) {
                  event.target.playVideo();
                }
              }
            },
            onStateChange: (event: any) => {
              // 1 = PLAYING, 2 = PAUSED, 0 = ENDED
              if (event.data === 1) {
                // Seamless handoff: Full YouTube stream is producing audio
                if (audioRef.current && !audioRef.current.paused) {
                  audioRef.current.pause();
                }
                setIsResolving(false);
                onPlayStateChange?.(true);
              } else if (event.data === 2) {
                onPlayStateChange?.(false);
              } else if (event.data === 0) {
                // Song ended - automatically advance to next song
                if (isAutoplayRef.current) {
                  if (!autoAdvanceTriggeredRef.current) {
                    autoAdvanceTriggeredRef.current = true;
                    console.log("Track finished, auto-advancing to next track...");
                    onNextRef.current?.();
                  }
                } else {
                  onPlayStateChange?.(false);
                }
              }
            },
            onError: (err: any) => {
              console.warn("YouTube player warning:", err);
              setIsResolving(false);
              if (audioRef.current && audioRef.current.src) {
                audioRef.current.play().catch(() => {});
              }
            },
          },
        });
      } catch (err) {
        console.error("Failed to init YouTube Player:", err);
      }
    };

    if (window.YT && window.YT.Player) {
      initPlayer();
    } else {
      window.onYouTubeIframeAPIReady = initPlayer;
    }
  }, []);

  // When currentTrack or playMode changes
  useEffect(() => {
    autoAdvanceTriggeredRef.current = false;

    if (!currentTrack) {
      if (audioRef.current) audioRef.current.pause();
      if (ytPlayerRef.current?.pauseVideo) ytPlayerRef.current.pauseVideo();
      setCurrentTime(0);
      return;
    }

    let isCancelled = false;

    if (playMode === "full") {
      // INSTANT PLAY ENGINE (< 50ms):
      // Immediately start HTML5 preview audio so sound output begins right away
      if (currentTrack.preview_url && audioRef.current) {
        audioRef.current.src = currentTrack.preview_url;
        audioRef.current.volume = isMuted ? 0 : volume;
        if (isPlaying) {
          audioRef.current.play().catch(() => {});
        }
      }

      const loadFullTrack = async () => {
        setIsResolving(true);
        let vid = currentTrack.youtube_id;

        if (!vid) {
          try {
            const info = await api.getPlayback(
              currentTrack.artist,
              currentTrack.title,
              currentTrack.spotify_id
            );
            vid = info.video_id;
          } catch (e) {
            console.error("Could not resolve video stream", e);
          }
        }

        if (isCancelled) return;

        if (vid) {
          setCurrentVideoId(vid);
          pendingVideoIdRef.current = vid;
          if (ytPlayerRef.current?.loadVideoById) {
            ytPlayerRef.current.loadVideoById(vid);
            ytPlayerRef.current.setVolume(isMuted ? 0 : volume * 100);
            if (isPlaying) {
              ytPlayerRef.current.playVideo();
            }
          }
        } else {
          // Fallback to preview if YouTube resolution fails
          setIsResolving(false);
          if (currentTrack.preview_url && audioRef.current) {
            audioRef.current.src = currentTrack.preview_url;
            if (isPlaying) audioRef.current.play().catch(() => {});
          }
        }
      };

      loadFullTrack();
    } else {
      // Preview mode (30s AAC)
      if (ytPlayerRef.current?.pauseVideo) ytPlayerRef.current.pauseVideo();
      if (currentTrack.preview_url && audioRef.current) {
        audioRef.current.src = currentTrack.preview_url;
        audioRef.current.volume = isMuted ? 0 : volume;
        if (isPlaying) {
          audioRef.current.play().catch(() => {});
        } else {
          audioRef.current.pause();
        }
      }
    }

    return () => {
      isCancelled = true;
    };
  }, [currentTrack, playMode]);

  // Sync play/pause state
  useEffect(() => {
    if (playMode === "full") {
      if (isPlaying) {
        ytPlayerRef.current?.playVideo?.();
        if (isResolving && audioRef.current && currentTrack?.preview_url) {
          audioRef.current.play().catch(() => {});
        }
      } else {
        ytPlayerRef.current?.pauseVideo?.();
        if (audioRef.current) audioRef.current.pause();
      }
    } else {
      if (audioRef.current) {
        if (isPlaying && currentTrack?.preview_url) {
          audioRef.current.play().catch(() => {});
        } else {
          audioRef.current.pause();
        }
      }
    }
  }, [isPlaying, playMode, isResolving, currentTrack]);

  // Scrubber timer for Full Song mode
  useEffect(() => {
    if (playMode !== "full") return;

    const timer = setInterval(() => {
      if (ytPlayerRef.current?.getCurrentTime && ytPlayerRef.current?.getDuration) {
        const cur = ytPlayerRef.current.getCurrentTime() || 0;
        const dur = ytPlayerRef.current.getDuration() || 0;
        if (dur > 0) {
          setCurrentTime(cur);
          setDuration(dur);

          // Safety auto-advance when reaching the end of the song
          if (
            isAutoplayRef.current &&
            dur > 10 &&
            cur >= dur - 0.5 &&
            !autoAdvanceTriggeredRef.current
          ) {
            autoAdvanceTriggeredRef.current = true;
            console.log("Reached song end in scrubber, auto-playing next track...");
            onNextRef.current?.();
          }
          return;
        }
      }

      // If YouTube is still buffering in background, sync with preview audio
      if (audioRef.current && !audioRef.current.paused) {
        setCurrentTime(audioRef.current.currentTime);
        setDuration(currentTrack?.duration_ms ? currentTrack.duration_ms / 1000 : 180);
      }
    }, 250);

    return () => clearInterval(timer);
  }, [playMode, currentTrack]);

  // HTML5 audio event handlers for Preview mode
  const handleAudioTimeUpdate = () => {
    if (playMode === "preview" && audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
      setDuration(audioRef.current.duration || 30);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    setCurrentTime(time);
    if (playMode === "full") {
      ytPlayerRef.current?.seekTo?.(time, true);
    } else if (audioRef.current) {
      audioRef.current.currentTime = time;
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    setIsMuted(val === 0);

    if (audioRef.current) {
      audioRef.current.volume = val;
    }
    if (ytPlayerRef.current?.setVolume) {
      ytPlayerRef.current.setVolume(val * 100);
      if (val === 0) ytPlayerRef.current.mute?.();
      else ytPlayerRef.current.unMute?.();
    }
  };

  const toggleMute = () => {
    if (isMuted) {
      const newVol = volume || 0.5;
      setIsMuted(false);
      if (audioRef.current) audioRef.current.volume = newVol;
      if (ytPlayerRef.current) {
        ytPlayerRef.current.unMute?.();
        ytPlayerRef.current.setVolume?.(newVol * 100);
      }
    } else {
      setIsMuted(true);
      if (audioRef.current) audioRef.current.volume = 0;
      if (ytPlayerRef.current) ytPlayerRef.current.mute?.();
    }
  };

  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs < 0) return "0:00";
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  return (
    <>
      <audio
        ref={audioRef}
        onTimeUpdate={handleAudioTimeUpdate}
        onEnded={() => {
          if (playMode === "preview" && isAutoplayRef.current) {
            if (!autoAdvanceTriggeredRef.current) {
              autoAdvanceTriggeredRef.current = true;
              console.log("Audio preview ended, auto-playing next track...");
              onNextRef.current?.();
            }
          }
        }}
      />

      {/* Persistent YouTube Player Container - kept in DOM so audio never stops when toggling video */}
      <div
        className={
          showVideo && currentTrack
            ? "fixed bottom-22 sm:bottom-24 right-3 sm:right-6 left-3 sm:left-auto max-w-[calc(100vw-1.5rem)] sm:w-96 z-50 bg-spotify-surface border border-spotify-divider rounded-2xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-5 duration-300"
            : "fixed bottom-0 right-0 w-64 h-36 -z-50 pointer-events-none opacity-0 overflow-hidden"
        }
      >
        {/* Floating Mini Player Header */}
        <div className="p-3 bg-zinc-900 flex items-center justify-between border-b border-spotify-divider">
          <div className="flex items-center gap-2 text-xs font-bold text-red-400 min-w-0">
            <Youtube className="w-4 h-4 flex-shrink-0" />
            <span className="truncate max-w-[180px] sm:max-w-[220px]">
              {currentTrack?.artist} - {currentTrack?.title}
            </span>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {currentVideoId && (
              <a
                href={`https://www.youtube.com/watch?v=${currentVideoId}`}
                target="_blank"
                rel="noreferrer"
                className="p-1 text-zinc-400 hover:text-white"
                title="Open on YouTube"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
            <button
              onClick={() => onToggleShowVideo(false)}
              className="p-1 text-zinc-400 hover:text-white"
              title="Hide video (keep audio playing)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Video Canvas */}
        <div className="aspect-video w-full bg-black">
          <div id="youtube-embed-player" className="w-full h-full" />
        </div>
      </div>

      {/* Persistent Bottom Player Bar */}
      <footer className="fixed bottom-0 left-0 right-0 z-40 h-[calc(5rem+env(safe-area-inset-bottom,0px))] pb-[env(safe-area-inset-bottom,0px)] bg-spotify-black/95 backdrop-blur-lg border-t border-spotify-divider px-3 sm:px-6 flex items-center justify-between shadow-2xl">
        {/* Left: Track Details & Badges */}
        <div className="flex items-center gap-2.5 sm:gap-3 w-1/3 sm:w-1/4 min-w-[120px] sm:min-w-[180px]">
          {currentTrack ? (
            <>
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-md overflow-hidden bg-zinc-800 flex-shrink-0 shadow">
                {currentTrack.image_url ? (
                  <img
                    src={currentTrack.image_url}
                    alt={currentTrack.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Disc3 className="w-5 h-5 sm:w-6 sm:h-6 text-zinc-600 m-2.5 sm:m-3" />
                )}
              </div>
              <div className="min-w-0">
                <h4 className="font-bold text-xs sm:text-sm text-white truncate">
                  {currentTrack.title}
                </h4>
                <p className="text-[10px] sm:text-[11px] text-spotify-muted truncate">
                  {currentTrack.artist}
                </p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  {isResolving ? (
                    <span className="inline-flex items-center gap-1 text-[9px] text-emerald-400 font-medium bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                      <Loader2 className="w-2.5 h-2.5 animate-spin text-amber-400" />
                      <span>Instant Play (Buffering Full...)</span>
                    </span>
                  ) : playMode === "full" ? (
                    <span className="inline-flex items-center gap-1 text-[9px] text-emerald-400 font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                      <Radio className="w-2.5 h-2.5" />
                      <span>Full Song</span>
                    </span>
                  ) : (
                    <span className="text-[9px] text-zinc-400">
                      30s Preview
                    </span>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="text-xs text-spotify-muted">
              Select a track to start listening
            </div>
          )}
        </div>

        {/* Center: Controls & Scrubber */}
        <div className="flex-1 max-w-lg flex flex-col items-center gap-1.5">
          <div className="flex items-center gap-3 sm:gap-4">
            {/* Play Mode Switcher (Full Song vs Preview) */}
            <div className="hidden md:flex items-center p-0.5 rounded-full bg-zinc-900 border border-zinc-800 text-[10px]">
              <button
                onClick={() => setPlayMode("full")}
                className={`px-2 py-0.5 rounded-full font-bold transition-all ${
                  playMode === "full"
                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-sm"
                    : "text-zinc-400 hover:text-white"
                }`}
                title="Play 100% full-length song"
              >
                Full Song
              </button>
              <button
                onClick={() => setPlayMode("preview")}
                className={`px-2 py-0.5 rounded-full font-medium transition-all ${
                  playMode === "preview"
                    ? "bg-zinc-800 text-white font-bold"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
                title="Fast 30-second preview clip"
              >
                Preview
              </button>
            </div>

            <button
              onClick={onPrev}
              className="text-spotify-muted hover:text-white transition-colors"
              title="Previous"
            >
              <SkipBack className="w-4 h-4" />
            </button>

            <button
              onClick={onTogglePlay}
              disabled={!currentTrack}
              className={`w-9 h-9 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 transition-transform shadow ${
                !currentTrack ? "opacity-50 cursor-not-allowed" : ""
              }`}
              title={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? (
                <Pause className="w-4 h-4 fill-black" />
              ) : (
                <Play className="w-4 h-4 fill-black ml-0.5" />
              )}
            </button>

            <button
              onClick={onNext}
              className="text-spotify-muted hover:text-white transition-colors"
              title="Next"
            >
              <SkipForward className="w-4 h-4" />
            </button>

            {/* Autoplay Next Song Toggle */}
            <button
              onClick={() => setIsAutoplay(!isAutoplay)}
              className={`p-1.5 sm:px-2.5 sm:py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all border ${
                isAutoplay
                  ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40 shadow-sm"
                  : "bg-zinc-900/80 hover:bg-zinc-800 text-zinc-500 border-zinc-800"
              }`}
              title={isAutoplay ? "Autoplay is ON (automatically plays next track)" : "Autoplay is OFF"}
            >
              <Repeat className={`w-3.5 h-3.5 ${isAutoplay ? "text-emerald-400" : "text-zinc-500"}`} />
              <span className="hidden sm:inline text-[10px] font-bold">Auto</span>
            </button>

            {/* Video Visualizer Toggle Button */}
            {currentTrack && (
              <button
                onClick={() => onToggleShowVideo(!showVideo)}
                className={`px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-colors border ${
                  showVideo
                    ? "bg-red-600/30 text-red-300 border-red-500/50 shadow-sm"
                    : "bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 border-zinc-700"
                }`}
                title={showVideo ? "Hide video" : "Watch official music video"}
              >
                <Tv className="w-3.5 h-3.5 text-red-400" />
                <span className="hidden sm:inline">Video</span>
              </button>
            )}

            {/* Offline Download Button */}
            {currentTrack && (
              <a
                href={api.getDownloadSongUrl(
                  currentTrack.artist,
                  currentTrack.title,
                  currentTrack.youtube_id || currentVideoId,
                  currentTrack.preview_url
                )}
                download
                className="px-2.5 py-1 rounded-full bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-emerald-400 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                title="Download full song for offline play"
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Offline</span>
              </a>
            )}
          </div>

          {/* Timeline Bar (Full length or preview) */}
          <div className="w-full flex items-center gap-2 text-[10px] text-spotify-muted">
            <span className="w-7 text-right">{formatTime(currentTime)}</span>
            <input
              type="range"
              min={0}
              max={duration || 180}
              step={0.1}
              value={currentTime}
              onChange={handleSeek}
              disabled={!currentTrack}
              className="flex-1 h-1 bg-zinc-800 rounded-full cursor-pointer hover:h-1.5 transition-all accent-spotify-green"
            />
            <span className="w-7">{formatTime(duration || 180)}</span>
          </div>
        </div>

        {/* Right: Volume Controls */}
        <div className="hidden sm:flex items-center justify-end gap-2 w-1/4">
          <button
            onClick={toggleMute}
            className="text-spotify-muted hover:text-white transition-colors"
            title={isMuted ? "Unmute" : "Mute"}
          >
            {isMuted || volume === 0 ? (
              <VolumeX className="w-4 h-4" />
            ) : (
              <Volume2 className="w-4 h-4" />
            )}
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={isMuted ? 0 : volume}
            onChange={handleVolumeChange}
            className="w-20 h-1 bg-zinc-800 rounded-full cursor-pointer accent-spotify-green"
          />
        </div>
      </footer>
    </>
  );
};
