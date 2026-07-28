import { Player } from "@/types";
import { Check } from "lucide-react";

const POS_COLOR: Record<string, string> = {
  GK: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  DEF: "bg-sky-500/15 text-sky-400 border-sky-500/30",
  MID: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  FWD: "bg-rose-500/15 text-rose-400 border-rose-500/30",
};

export default function PlayerCard({
  player,
  selected,
  disabled,
  onClick,
  rightSlot,
}: {
  player: Player;
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  rightSlot?: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex w-full items-center justify-between rounded-xl border px-3 py-3 text-left transition ${
        selected
          ? "border-emerald-500/40 bg-emerald-500/10"
          : disabled
          ? "border-pitch-border bg-pitch-surface/40 opacity-40"
          : "border-pitch-border bg-pitch-surface hover:border-violet-500/50"
      }`}
    >
      <div className="flex items-center gap-3">
        <span className={`rounded-md border px-2 py-1 text-[10px] font-bold ${POS_COLOR[player.position]}`}>
          {player.position}
        </span>
        <div>
          <div className="text-sm font-semibold text-white">{player.name}</div>
          <div className="text-xs text-slate-500">
            {player.team?.name}
            {player.team?.is_gullhaug ? " ★" : ""}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {rightSlot}
        <span className="font-mono text-sm text-slate-300">{player.price.toFixed(1)}M</span>
        {selected && <Check size={16} className="text-emerald-400" />}
      </div>
    </button>
  );
}
