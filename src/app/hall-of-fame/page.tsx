import { createClient } from "@/lib/supabase/server";
import { Trophy, Medal } from "lucide-react";

export const revalidate = 300;

export default async function HallOfFamePage() {
  const supabase = createClient();

  const { data: archive } = await supabase
    .from("hall_of_fame")
    .select(`
      *,
      season:seasons(*),
      champion:fantasy_teams!hall_of_fame_champion_team_id_fkey(team_name),
      runner_up:fantasy_teams!hall_of_fame_runner_up_team_id_fkey(team_name),
      third:fantasy_teams!hall_of_fame_third_place_team_id_fkey(team_name),
      highest_gw_team:fantasy_teams!hall_of_fame_highest_gameweek_team_id_fkey(team_name),
      best_captain:players!hall_of_fame_best_captain_player_id_fkey(name),
      most_goals_player:players!hall_of_fame_most_goals_player_id_fkey(name),
      most_cs_player:players!hall_of_fame_most_clean_sheets_player_id_fkey(name)
    `)
    .order("created_at", { ascending: false });

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="font-display text-2xl font-black text-slate-900">Hall of Fame</h1>
      <p className="mt-1 text-sm text-slate-500">Every completed season, archived forever.</p>

      <div className="mt-6 space-y-6">
        {(archive ?? []).map((h: any) => (
          <div key={h.id} className="rounded-2xl border border-pitch-border bg-gradient-to-br from-slate-100 to-emerald-600/10 p-5">
            <h2 className="font-display text-xl font-bold text-slate-900">Season {h.season?.label}</h2>

            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              <Podium place={1} icon={<Trophy size={18} className="text-amber-600" />} name={h.champion?.team_name} />
              <Podium place={2} icon={<Medal size={18} className="text-slate-700" />} name={h.runner_up?.team_name} />
              <Podium place={3} icon={<Medal size={18} className="text-orange-400" />} name={h.third?.team_name} />
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
              <Stat label="Highest total points" value={h.highest_total_points} />
              <Stat label="Best gameweek score" value={`${h.highest_gameweek_score} (${h.highest_gw_team?.team_name ?? "—"})`} />
              <Stat label="Best captain score" value={`${h.best_captain_score} pts (${h.best_captain?.name ?? "—"})`} />
              <Stat label="Most goals" value={`${h.most_goals_count} (${h.most_goals_player?.name ?? "—"})`} />
              <Stat label="Most clean sheets" value={`${h.most_clean_sheets_count} (${h.most_cs_player?.name ?? "—"})`} />
            </div>
          </div>
        ))}
        {(!archive || archive.length === 0) && (
          <p className="text-sm text-slate-500">No completed seasons yet — the Hall of Fame fills in once the admin ends a season.</p>
        )}
      </div>
    </div>
  );
}

function Podium({ place, icon, name }: { place: number; icon: React.ReactNode; name?: string }) {
  return (
    <div className="rounded-lg bg-pitch-surface border border-pitch-border px-3 py-2 text-center">
      <div className="flex items-center justify-center gap-1 text-xs text-slate-500">
        {icon} #{place}
      </div>
      <div className="mt-1 text-sm font-bold text-slate-900">{name ?? "—"}</div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: any }) {
  return (
    <div className="rounded-lg bg-pitch px-3 py-2">
      <div className="text-[11px] text-slate-500">{label}</div>
      <div className="font-mono font-bold text-slate-900">{value ?? "—"}</div>
    </div>
  );
}
