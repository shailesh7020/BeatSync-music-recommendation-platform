import React from "react";
import { Flame, Globe, Zap, Radio, Disc3, Sparkles } from "lucide-react";

interface PopularCategorySelectorProps {
  selectedCategory: string;
  onSelectCategory: (category: string) => void;
}

const CATEGORIES = [
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

export const PopularCategorySelector: React.FC<PopularCategorySelectorProps> = ({
  selectedCategory,
  onSelectCategory,
}) => {
  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            Spotify Reference
          </span>
          <h2 className="text-sm uppercase tracking-wider text-spotify-muted font-bold">
            Explore By Chart & Genre
          </h2>
        </div>
        <span className="text-xs text-zinc-400 hidden sm:inline">
          High-fidelity streaming & continuous feature matching
        </span>
      </div>

      <div className="flex items-center gap-2.5 overflow-x-auto pb-2 scrollbar-none">
        {CATEGORIES.map((cat) => {
          const Icon = cat.icon;
          const isSelected = selectedCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => onSelectCategory(cat.id)}
              className={`group flex items-center gap-2 px-3.5 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all border ${
                isSelected
                  ? "bg-spotify-green text-black border-spotify-green font-bold shadow-lg shadow-spotify-green/20 scale-105"
                  : `bg-spotify-surface hover:bg-spotify-card ${cat.color} hover:border-spotify-green/40`
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isSelected ? "text-black" : ""}`} />
              <span>{cat.name}</span>
              <span
                className={`text-[9px] px-1.5 py-0.2 rounded-full font-bold uppercase transition-colors ${
                  isSelected
                    ? "bg-black/20 text-black"
                    : "bg-black/40 text-zinc-400 group-hover:text-zinc-200"
                }`}
              >
                {cat.badge}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
