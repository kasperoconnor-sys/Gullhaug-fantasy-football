import { createClient } from "@/lib/supabase/server";
import { Trophy } from "lucide-react";

export const revalidate = 120;

const POS_ORDER = ["GK", "DEF", "MID", "FWD"];

export default async function TeamOfTheWeekPage() {
  const supabase = createClient();

  const { data: archive } = await supabase
    .from("team_of_the_week")
    .select("*, gameweek:gameweeks(*), players:team_of_the_week_players(*, player:players(*, team:teams(*)))")
    .order("created_at", { ascending: false });

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="font-display text-2xl font-black text-white">Team of the Week</h1>
      <p className="mt-1 text-sm text-slate-500">Archive of every gameweek's best XI.</p>

      <div className="mt-6 space-y-8">
        {(archive ?? []).map((totw: any) => {
          const rows = POS_ORDER.map((pos) => totw.players.filter((tp: any) => tp.player.position === pos));
          return (
            <div key={totw.id}>
              <div className="flex items-center justify-between px-1">
                <h2 className="font-display text-lg font-bold text-white">Gameweek {totw.gameweek?.number}</h2>
                <span className="flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-bold text-amber-300">
                  <Trophy size={12} /> {totw.total_points} pts
                </span>
              </div>
              <p className="px-1 text-xs text-slate-500">Formation: {totw.formation}</p>

              <div className="mt-3 rounded-2xl bg-gradient-to-b from-emerald-800 to-emerald-900 border border-emerald-700/50 p-3 relative overflow-hidden shadow-card">
                <div className="absolute inset-3 border border-white/15 rounded-lg pointer-events-none" />
                <div className="relative z-10 space-y-4 py-3">
                  {rows.map((rowPlayers, i) => (
                    <div key={i} className="flex flex-wrap justify-center gap-2">
                      {rowPlayers.map((tp: any) => (
                        <div
                          key={tp.id}
                          className={`flex w-[86px] flex-col items-center rounded-xl border px-1.5 py-2 text-center backdrop-blur ${
                            tp.is_captain ? "border-amber-400/60 bg-amber-500/15 shadow-goldGlow" : "border-white/20 bg-black/30"
                          }`}
                        >
                          <div className="truncate w-full text-[11px] font-bold text-white">
                            {tp.player.name.split(" ").slice(-1)[0]} {tp.is_captain && <span className="text-amber-300">(C)</span>}
                          </div>
                          <div className="mt-0.5 font-mono text-xs font-black text-emerald-300">{tp.points}p</div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
        {(!archive || archive.length === 0) && (
          <p className="text-sm text-slate-500">Team of the Week is generated automatically once a gameweek is completed.</p>
        )}
      </div>
    </div>
  );
}
