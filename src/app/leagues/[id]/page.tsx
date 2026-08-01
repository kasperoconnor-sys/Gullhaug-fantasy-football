import { createClient } from "@/lib/supabase/server";
import { Trophy } from "lucide-react";

export default async function LeagueDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient();

  const { data: league } = await supabase.from("fantasy_leagues").select("*").eq("id", params.id).single();
  const { data: members } = await supabase
    .from("league_members")
    .select("fantasy_team:fantasy_teams(*)")
    .eq("league_id", params.id);

  const teamIds = (members ?? []).map((m: any) => m.fantasy_team.id);

  const { data: scores } = teamIds.length
    ? await supabase.from("fantasy_team_gameweek_scores").select("*").in("fantasy_team_id", teamIds)
    : { data: [] as any[] };

  const totals = new Map<string, number>();
  (scores ?? []).forEach((s: any) => totals.set(s.fantasy_team_id, (totals.get(s.fantasy_team_id) ?? 0) + s.net_points));

  const standings = (members ?? [])
    .map((m: any) => ({ team: m.fantasy_team, total: totals.get(m.fantasy_team.id) ?? 0 }))
    .sort((a, b) => b.total - a.total);

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="font-display text-2xl font-black text-slate-900">{league?.name}</h1>
      <p className="mt-1 font-mono text-xs text-slate-500">Invite code: {league?.invite_code}</p>

      <h2 className="mt-6 text-sm font-bold text-slate-500">Overall</h2>
      <div className="mt-2 divide-y divide-pitch-border rounded-xl border border-pitch-border bg-pitch-surface">
        {standings.map((s, i) => (
          <div key={s.team.id} className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3">
              <span className={`w-5 text-sm font-bold ${i === 0 ? "text-amber-400" : "text-slate-500"}`}>
                {i === 0 ? <Trophy size={16} /> : i + 1}
              </span>
              <span className="text-sm font-semibold text-slate-900">{s.team.team_name}</span>
            </div>
            <span className="font-mono text-sm font-bold text-emerald-400">{s.total} p</span>
          </div>
        ))}
        {standings.length === 0 && <p className="px-4 py-3 text-sm text-slate-500">No members yet.</p>}
      </div>
    </div>
  );
}
