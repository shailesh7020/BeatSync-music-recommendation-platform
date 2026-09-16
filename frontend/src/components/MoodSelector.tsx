import React from "react";
import { Flame, BookOpen, Moon, PartyPopper, Smile, CloudRain } from "lucide-react";

interface MoodSelectorProps {
  selectedMood: string;
  onSelectMood: (mood: string) => void;
}

const MOODS = [
  { id: "workout", name: "Workout", icon: Flame, color: "from-orange-500/20 to-red-500/20 border-orange-500/30 text-orange-400" },
  { id: "study", name: "Deep Focus", icon: BookOpen, color: "from-blue-500/20 to-cyan-500/20 border-blue-500/30 text-blue-400" },
  { id: "chill", name: "Late Night Chill", icon: Moon, color: "from-indigo-500/20 to-purple-500/20 border-indigo-500/30 text-indigo-400" },
  { id: "party", name: "Party Vibe", icon: PartyPopper, color: "from-pink-500/20 to-purple-500/20 border-pink-500/30 text-pink-400" },
  { id: "happy", name: "Feel Good", icon: Smile, color: "from-amber-500/20 to-yellow-500/20 border-amber-500/30 text-amber-400" },
  { id: "melancholy", name: "Melancholy", icon: CloudRain, color: "from-slate-500/20 to-zinc-500/20 border-slate-500/30 text-slate-400" },
];

export const MoodSelector: React.FC<MoodSelectorProps> = ({
  selectedMood,
  onSelectMood,
}) => {
  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm uppercase tracking-wider text-spotify-muted font-bold">
          Filter By Vibe & Activity
        </h2>
        <span className="text-xs text-zinc-400">
          Powered by Audio Feature Vector Matching
        </span>
      </div>

      <div className="flex items-center gap-2.5 overflow-x-auto pb-2 scrollbar-none">
        {MOODS.map((m) => {
          const Icon = m.icon;
          const isSelected = selectedMood === m.id;
          return (
            <button
              key={m.id}
              onClick={() => onSelectMood(m.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all border ${
                isSelected
                  ? "bg-spotify-green text-black border-spotify-green font-bold shadow-lg shadow-spotify-green/20 scale-105"
                  : `bg-spotify-surface hover:bg-spotify-card ${m.color} hover:border-spotify-green/40`
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isSelected ? "text-black" : ""}`} />
              <span>{m.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
