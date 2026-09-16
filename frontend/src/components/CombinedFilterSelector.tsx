import React from "react";
import {
  Flame,
  Globe,
  Zap,
  Radio,
  Disc3,
  Sparkles,
  BookOpen,
  Moon,
  PartyPopper,
  Smile,
  CloudRain,
} from "lucide-react";

export interface CombinedFilterSelectorProps {
  activeId: string;
  isMood: boolean;
  onSelectPopular: (category: string) => void;
  onSelectMood: (mood: string) => void;
}

const POPULAR_CATEGORIES = [
  {
    id: "all",
    name: "Spotify All-Time Hits",
    icon: Flame,
    color: "from-emerald-500/20 to-teal-500/20 border-emerald-500/30 text-emerald-400",
    badge: "Billions Club",
  },
  {
    id: "charts",
    name: "Global Top 50 Daily",
    icon: Globe,
    color: "from-blue-500/20 to-cyan-500/20 border-blue-500/30 text-blue-400",
    badge: "Live Charts",
  },
  {
    id: "pop",
    name: "Top Pop",
    icon: Sparkles,
    color: "from-pink-500/20 to-rose-500/20 border-pink-500/30 text-pink-400",
    badge: "Viral Hits",
  },
  {
    id: "hiphop",
    name: "Hip-Hop & Rap",
    icon: Radio,
    color: "from-amber-500/20 to-orange-500/20 border-amber-500/30 text-amber-400",
    badge: "Top Streamed",
  },
  {
    id: "dance",
    name: "Electronic & Club",
    icon: Zap,
    color: "from-purple-500/20 to-indigo-500/20 border-purple-500/30 text-purple-400",
    badge: "High Energy",
  },
  {
    id: "rock",
    name: "Rock & Alt Anthems",
    icon: Disc3,
    color: "from-red-500/20 to-stone-500/20 border-red-500/30 text-red-400",
    badge: "Legends",
  },
];

const MOOD_CATEGORIES = [
  {
    id: "workout",
    name: "Workout",
    icon: Flame,
    color: "from-orange-500/20 to-red-500/20 border-orange-500/30 text-orange-400",
    badge: "High BPM",
  },
  {
    id: "study",
    name: "Deep Focus",
    icon: BookOpen,
    color: "from-blue-500/20 to-cyan-500/20 border-blue-500/30 text-blue-400",
    badge: "Study & Code",
  },
  {
    id: "chill",
    name: "Late Night Chill",
    icon: Moon,
    color: "from-indigo-500/20 to-purple-500/20 border-indigo-500/30 text-indigo-400",
    badge: "Lo-Fi & Relax",
  },
  {
    id: "party",
    name: "Party Vibe",
    icon: PartyPopper,
    color: "from-pink-500/20 to-purple-500/20 border-pink-500/30 text-pink-400",
    badge: "Celebration",
  },
  {
    id: "happy",
    name: "Feel Good",
    icon: Smile,
    color: "from-amber-500/20 to-yellow-500/20 border-amber-500/30 text-amber-400",
    badge: "Upbeat",
  },
  {
    id: "melancholy",
    name: "Melancholy",
    icon: CloudRain,
    color: "from-slate-500/20 to-zinc-500/20 border-slate-500/30 text-slate-400",
    badge: "Acoustic",
  },
];

export const CombinedFilterSelector: React.FC<CombinedFilterSelectorProps> = ({
  activeId,
  isMood,
  onSelectPopular,
  onSelectMood,
}) => {
  return (
    <div className="mb-8 space-y-4 bg-spotify-surface/40 p-4 rounded-2xl border border-spotify-divider/40">
      {/* Row 1: Popular Hits & Global Charts */}
      <div>
        <div className="flex items-center justify-between mb-2 px-0.5">
          <div className="flex items-center gap-2">
            <Flame className="w-3.5 h-3.5 text-amber-400" />
            <h3 className="text-xs uppercase tracking-wider text-zinc-300 font-bold">
              Popular Hits & Charts
            </h3>
          </div>
          <span className="text-[11px] text-spotify-muted hidden sm:inline">
            Spotify References & Billboard Hits
          </span>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1.5 scrollbar-none">
          {POPULAR_CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            const isSelected = !isMood && activeId === cat.id;

            return (
              <button
                key={cat.id}
                onClick={() => onSelectPopular(cat.id)}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all border ${
                  isSelected
                    ? "bg-spotify-green text-black border-spotify-green font-extrabold shadow-lg shadow-spotify-green/20 scale-105"
                    : `bg-spotify-surface hover:bg-spotify-card ${cat.color} hover:border-spotify-green/40`
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isSelected ? "text-black" : ""}`} />
                <span>{cat.name}</span>
                <span
                  className={`text-[9px] px-1.5 py-0.2 rounded-full font-medium ${
                    isSelected
                      ? "bg-black/20 text-black"
                      : "bg-white/10 text-zinc-300"
                  }`}
                >
                  {cat.badge}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Row 2: Moods & Acoustic Vibes */}
      <div>
        <div className="flex items-center justify-between mb-2 px-0.5">
          <div className="flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            <h3 className="text-xs uppercase tracking-wider text-zinc-300 font-bold">
              Moods & Acoustic Vibes
            </h3>
          </div>
          <span className="text-[11px] text-spotify-muted hidden sm:inline">
            Acoustic Vector Cosine Match
          </span>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1.5 scrollbar-none">
          {MOOD_CATEGORIES.map((mood) => {
            const Icon = mood.icon;
            const isSelected = isMood && activeId === mood.id;

            return (
              <button
                key={mood.id}
                onClick={() => onSelectMood(mood.id)}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all border ${
                  isSelected
                    ? "bg-spotify-green text-black border-spotify-green font-extrabold shadow-lg shadow-spotify-green/20 scale-105"
                    : `bg-spotify-surface hover:bg-spotify-card ${mood.color} hover:border-spotify-green/40`
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isSelected ? "text-black" : ""}`} />
                <span>{mood.name}</span>
                <span
                  className={`text-[9px] px-1.5 py-0.2 rounded-full font-medium ${
                    isSelected
                      ? "bg-black/20 text-black"
                      : "bg-white/10 text-zinc-300"
                  }`}
                >
                  {mood.badge}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
