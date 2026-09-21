import React, { useState, useEffect } from "react";
import { Search, Music2, Sparkles, Activity, X } from "lucide-react";
import { api } from "../services/api";

interface NavbarProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  activeTab: "popular" | "moods" | "foryou" | "search";
  setActiveTab: (tab: "popular" | "moods" | "foryou" | "search") => void;
  onOpenPromptModal: () => void;
  onOpenSocialRoom: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  searchQuery,
  onSearchChange,
  activeTab,
  setActiveTab,
  onOpenPromptModal,
  onOpenSocialRoom,
}) => {
  const [isBackendHealthy, setIsBackendHealthy] = useState<boolean | null>(null);

  useEffect(() => {
    api.checkHealth()
      .then(() => setIsBackendHealthy(true))
      .catch(() => setIsBackendHealthy(false));
  }, []);

  return (
    <header className="sticky top-0 z-40 bg-spotify-black/95 backdrop-blur-md border-b border-spotify-divider px-4 sm:px-6 py-2.5 pt-safe">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Top Row on Mobile: Logo & Search Bar */}
        <div className="flex items-center justify-between gap-3 w-full md:w-auto flex-1">
          {/* Logo */}
          <div
            onClick={() => {
              onSearchChange("");
              setActiveTab("popular");
            }}
            className="flex items-center gap-2 cursor-pointer group flex-shrink-0"
          >
            <div className="w-9 h-9 rounded-full bg-spotify-green flex items-center justify-center shadow-lg shadow-spotify-green/20 group-hover:scale-105 transition-transform">
              <Music2 className="w-5 h-5 text-black" />
            </div>
            <div>
              <span className="font-extrabold text-lg sm:text-xl tracking-tight bg-gradient-to-r from-white via-zinc-200 to-spotify-green bg-clip-text text-transparent">
                BeatSync
              </span>
              <span className="hidden sm:inline-block ml-2 px-1.5 py-0.5 text-[9px] font-bold uppercase rounded bg-spotify-card text-spotify-green border border-spotify-green/30">
                AI
              </span>
            </div>
          </div>

          {/* Search Bar */}
          <div className="flex-1 max-w-md relative">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-spotify-muted" />
              <input
                type="text"
                placeholder="Search songs or artists..."
                value={searchQuery}
                onChange={(e) => {
                  onSearchChange(e.target.value);
                  if (e.target.value.trim() && activeTab !== "search") {
                    setActiveTab("search");
                  }
                }}
                className="w-full pl-9 pr-8 py-1.5 sm:py-2 bg-spotify-surface text-white placeholder-spotify-muted rounded-full border border-transparent focus:border-spotify-green focus:bg-spotify-card focus:outline-none text-xs sm:text-sm transition-all shadow-inner"
              />
              {searchQuery && (
                <button
                  onClick={() => {
                    onSearchChange("");
                    setActiveTab("popular");
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-spotify-muted hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Backend Status Indicator (Mobile) */}
          <div
            title={isBackendHealthy ? "Backend connected" : "Connecting..."}
            className="md:hidden flex items-center p-1.5 rounded-full bg-spotify-surface border border-spotify-divider flex-shrink-0"
          >
            <span
              className={`w-2 h-2 rounded-full ${
                isBackendHealthy === true
                  ? "bg-emerald-400 animate-pulse"
                  : isBackendHealthy === false
                  ? "bg-red-400"
                  : "bg-yellow-400"
              }`}
            />
          </div>
        </div>

        {/* Navigation Tabs & Actions Row */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0 scrollbar-none flex-shrink-0">
          {/* Combined Hits & Moods Discovery Tab */}
          <button
            onClick={() => {
              onSearchChange("");
              setActiveTab("popular");
            }}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
              activeTab === "popular" || activeTab === "moods"
                ? "bg-white text-black font-extrabold shadow-md scale-105"
                : "bg-spotify-surface hover:bg-spotify-card text-zinc-300"
            }`}
          >
            🔥 Hits & Moods
          </button>

          <button
            onClick={() => {
              onSearchChange("");
              setActiveTab("foryou");
            }}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap transition-all ${
              activeTab === "foryou"
                ? "bg-spotify-green text-black font-bold shadow-lg shadow-spotify-green/20"
                : "bg-spotify-surface hover:bg-spotify-card text-zinc-300"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>For You</span>
          </button>

          {/* AI Prompt-to-Playlist Trigger */}
          <button
            onClick={onOpenPromptModal}
            className="px-3 py-1.5 rounded-full text-xs font-bold bg-gradient-to-r from-emerald-500/20 to-teal-500/20 hover:from-emerald-500/30 hover:to-teal-500/30 border border-emerald-500/40 text-emerald-300 flex items-center gap-1.5 shadow-sm whitespace-nowrap transition-all"
            title="Generate playlist from natural language prompt"
          >
            <span>✨ AI Prompt</span>
          </button>

          {/* Social Listen Together Trigger */}
          <button
            onClick={onOpenSocialRoom}
            className="px-3 py-1.5 rounded-full text-xs font-bold bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/40 text-purple-300 flex items-center gap-1.5 whitespace-nowrap transition-all"
            title="Join live social room"
          >
            <span>📻 Jam Room</span>
          </button>

          {/* Backend Status Indicator (Desktop) */}
          <div
            title={isBackendHealthy ? "Backend connected (FastAPI)" : "Backend connecting..."}
            className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-spotify-surface border border-spotify-divider text-[11px] text-spotify-muted flex-shrink-0"
          >
            <span
              className={`w-2 h-2 rounded-full ${
                isBackendHealthy === true
                  ? "bg-emerald-400 animate-pulse"
                  : isBackendHealthy === false
                  ? "bg-red-400"
                  : "bg-yellow-400"
              }`}
            />
            <span>{isBackendHealthy ? "Online" : "Offline"}</span>
          </div>
        </div>
      </div>
    </header>
  );
};

