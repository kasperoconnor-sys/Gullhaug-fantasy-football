import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import StatCard from "@/components/StatCard";

export default async function ProfilePage() {
  const supabase = createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login");

  const { data: team } = await supabase.from("fantasy_teams").select("*").eq("user_id", userData.user.id).single();
  if (!team) redirect("/squad");

  const [
    { data: hofChampion },
    { data: hofRunnerUp },
    { data: hofThird },
    { data: bestGw },
    { data: lineups },
    { data: squadPlayers },
    { data: transfers },
    { data: chips },
    { data: achievementsUnlocked },
  ] = await Promise.all([
    supabase.from("hall_of_fame").select("id").eq("champion_team_id", team.id),
    supabase.from("hall_of_fame").select("id").eq("runner_up_team_id", team.id),
    supabase.from("hall_of_fame").select("id").eq("third_place_team_id", team.id),
    supabase.from("fantasy_team_gameweek_scores").select("net_points").eq("fantasy_team_id", team.id).order("net_points", { ascending: false }).limit(1),
    supabase.from("gameweek_lineups").select("formation").eq("fantasy_team_id", team.id),
    supabase.from("fantasy_squad_players").select("player:players(*, team:teams(*))").eq("fantasy_team_id", team.id),
    supabase.from("transfers").select("id").eq("fantasy_team_id", team.id),
    supabase.from("chip_usages").select("chip").eq("fantasy_team_id", team.id),
    supabase.from("manager_achievements").select("id").eq("fantasy_team_id", team.id),
  ]);

  const formationCounts = new Map<string, number>();
  (lineups ?? []).forEach((l: any) => formationCounts.set(l.formation, (formationCounts.get(l.formation) ?? 0) + 1));
  const favouriteFormation = [...formationCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";

  const teamCounts = new Map<string, number>();
  (squadPlayers ?? []).forEach((r: any) => {
    const name = r.player?.team?.name;
    if (name) teamCounts.set(name, (teamCounts.get(name) ?? 0) + 1);
  });
  const favouriteClub = [...teamCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";

  const { count: seasonsPlayed } = await supabase.from("seasons").select("*", { count: "exact", head: true });

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="font-display text-2xl font-black text-white">{team.team_name}</h1>
      <p className="mt-1 text-sm text-slate-500">Manager profile</p>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard label="Seasons played" value={seasonsPlayed ?? 1} />
        <StatCard label="League titles" value={hofChampion?.length ?? 0} accent="emerald" />
        <StatCard label="Runner-up finishes" value={hofRunnerUp?.length ?? 0} />
        <StatCard label="Top 3 finishes" value={(hofChampion?.length ?? 0) + (hofRunnerUp?.length ?? 0) + (hofThird?.length ?? 0)} accent="emerald" />
        <StatCard label="Best ever gameweek" value={bestGw?.[0]?.net_points ?? "—"} />
        <StatCard label="Total transfers" value={transfers?.length ?? 0} />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <StatCard label="Favourite formation" value={favouriteFormation} accent="emerald" />
        <StatCard label="Favourite club" value={favouriteClub} />
      </div>

      <div className="mt-6">
        <h2 className="text-sm font-bold text-slate-400">Chips used</h2>
        <div className="mt-2 flex flex-wrap gap-2">
          {(chips ?? []).map((c: any, i: number) => (
            <span key={i} className="rounded-full bg-violet-500/15 border border-violet-500/30 px-3 py-1 text-xs font-bold text-violet-300">
              {c.chip.replace("_", " ")}
            </span>
          ))}
          {(!chips || chips.length === 0) && <span className="text-xs text-slate-600">None used yet</span>}
        </div>
      </div>

      <div className="mt-4">
        <h2 className="text-sm font-bold text-slate-400">Achievements unlocked</h2>
        <p className="mt-1 font-mono text-lg font-bold text-white">{achievementsUnlocked?.length ?? 0} / 11</p>
      </div>
    </div>
  );
}
