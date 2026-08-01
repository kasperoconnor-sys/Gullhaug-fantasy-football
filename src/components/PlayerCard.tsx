import { Player } from "@/types";
import { Check } from "lucide-react";

const POS_COLOR: Record<string, string> = {
  GK: "bg-amber-50 text-amber-700 border-amber-200",
  DEF: "bg-sky-50 text-sky-700 border-sky-200",
  MID: "bg-emerald-50 text-emerald-700 border-emerald-200",
  FWD: "bg-rose-50 text-rose-700 border-rose-200",
};

interface ExtraStats {
  ownershipPct?: number;
  form?: number;
  avgPoints?: number;
}

export default function PlayerCard({
  player,
  selected,
  disabled,
  onClick,
  rightSlot,
  stats,
}: {
  player: Player;
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  rightSlot?: React.ReactNode;
  stats?: ExtraStats;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`card-premium flex w-full items-center justify-between rounded-xl px-3 py-3 text-left transition-all duration-150 active:scale-[0.98] ${
        selected
          ? "border-emerald-500/50 shadow-[0_0_0_1px_rgba(16,185,129,0.5)] bg-emerald-500/10"
          : disabled
          ? "opacity-40"
          : "hover:border-violet-300"
      }`}
    >
      <div className="flex items-center gap-3">
        <span className={`rounded-md border px-2 py-1 text-[10px] font-bold ${POS_COLOR[player.position]}`}>
          {player.position}
        </span>
        <div>
          <div className="text-sm font-semibold text-slate-900">{player.name}</div>
          <div className="flex flex-wrap items-center gap-x-2 text-xs text-slate-500">
            <span>
              {player.team?.name}
              {player.team?.is_gullhaug ? " ★" : ""}
            </span>
            {stats?.ownershipPct !== undefined && <span className="text-slate-400">{stats.ownershipPct.toFixed(1)}% owned</span>}
            {stats?.form !== undefined && <span className="text-slate-400">form {stats.form.toFixed(1)}</span>}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {rightSlot}
        <span className="font-mono text-sm font-bold text-slate-900">{player.price.toFixed(1)}M</span>
        {selected && <Check size={16} className="text-emerald-400" />}
      </div>
    </button>
  );
}
