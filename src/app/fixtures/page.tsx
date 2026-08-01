import { createClient } from "@/lib/supabase/server";
import FDRBadge from "@/components/FDRBadge";
import Link from "next/link";

export const revalidate = 120;

export default async function FixturePlannerPage({ searchParams }: { searchParams: { sort?: string } }) {
  const supabase = createClient();
  const sortEasiest = searchParams.sort === "easiest";

  const { data: teams } = await supabase.from("teams").select("*").order("name");
  const { data: fixtures } = await supabase
    .from("fixtures")
    .select("*, home_team:teams!fixtures_home_team_id_fkey(*), away_team:teams!fixtures_away_team_id_fkey(*)")
    .eq("is_final", false)
    .order("kickoff_at", { ascending: true });

  const rows = (teams ?? []).map((team) => {
    const upcoming = (fixtures ?? [])
      .filter((f: any) => f.home_team_id === team.id || f.away_team_id === team.id)
      .slice(0, 5)
      .map((f: any) => ({
        fdr: f.home_team_id === team.id ? f.home_fdr : f.away_fdr,
        opponent: f.home_team_id === team.id ? f.away_team?.name : f.home_team?.name,
        isHome: f.home_team_id === team.id,
        kickoff: f.kickoff_at,
      }));
    const avgFdr = upcoming.length ? upcoming.reduce((s, u) => s + u.fdr, 0) / upcoming.length : 99;
    return { team, upcoming, avgFdr };
  });

  const sorted = sortEasiest ? [...rows].sort((a, b) => a.avgFdr - b.avgFdr) : rows;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-black text-slate-900">Fixture Planner</h1>
        <div className="flex gap-2 text-xs font-bold">
          <Link href="/fixtures" className={`rounded-full px-3 py-1.5 ${!sortEasiest ? "bg-slate-900 text-white" : "bg-pitch-surface text-slate-500 border border-pitch-border"}`}>
            By team
          </Link>
          <Link href="/fixtures?sort=easiest" className={`rounded-full px-3 py-1.5 ${sortEasiest ? "bg-emerald-500 text-slate-950" : "bg-pitch-surface text-slate-500 border border-pitch-border"}`}>
            Easiest run
          </Link>
        </div>
      </div>
      <p className="mt-1 text-sm text-slate-500">Next 5 fixtures per team, with difficulty ratings.</p>

      <div className="mt-4 space-y-3">
        {sorted.map(({ team, upcoming, avgFdr }) => (
          <div key={team.id} className="rounded-xl border border-pitch-border bg-pitch-surface p-4">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-900">
                {team.name} {team.is_gullhaug && <span className="text-emerald-600">★</span>}
              </span>
              {upcoming.length > 0 && <span className="text-xs text-slate-500">avg FDR {avgFdr.toFixed(1)}</span>}
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {upcoming.map((u, i) => (
                <div key={i} className="flex items-center gap-1 rounded-lg bg-pitch px-2 py-1 text-xs text-slate-700">
                  {u.isHome ? "vs" : "@"} {u.opponent}
                  <FDRBadge rating={u.fdr} />
                </div>
              ))}
              {upcoming.length === 0 && <span className="text-xs text-slate-400">No upcoming fixtures scheduled.</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
