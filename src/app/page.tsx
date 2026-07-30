import { createClient } from "@/lib/supabase/server";
import FDRBadge from "@/components/FDRBadge";
import DeadlineCountdown from "@/components/DeadlineCountdown";
import Link from "next/link";
import { Trophy, Shield, ArrowRight, Award, TrendingUp, TrendingDown } from "lucide-react";

export const revalidate = 60;

const AWARD_LABELS: Record<string, string> = {
  manager_of_the_week: "🔥 Manager of the Week",
  unluckiest_manager: "💀 Unluckiest Manager",
  captain_of_the_week: "👑 Captain of the Week",
  best_differential: "💎 Best Differential",
  best_defence: "🛡 Best Defence",
  highest_attack: "⚽ Highest Attack",
};

export default async function HomePage() {
  const supabase = createClient();

  const { data: currentGw } = await supabase
    .from("gameweeks")
    .select("*")
    .in("status", ["open", "in_progress"])
    .order("number", { ascending: true })
    .limit(1)
    .maybeSingle();

  const { data: nextDeadlineGw } = await supabase
    .from("gameweeks")
    .select("*")
    .in("status", ["upcoming", "open"])
    .order("number", { ascending: true })
    .limit(1)
    .maybeSingle();

  const { data: fixtures } = currentGw
    ? await supabase
        .from("fixtures")
        .select("*, home_team:teams!fixtures_home_team_id_fkey(*), away_team:teams!fixtures_away_team_id_fkey(*)")
        .eq("gameweek_id", currentGw.id)
        .order("kickoff_at", { ascending: true })
    : { data: [] as any[] };

  const { data: latestTotw } = await supabase
    .from("team_of_the_week")
    .select("*, gameweek:gameweeks(*)")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: latestAwards } = latestTotw
    ? await supabase
        .from("weekly_awards")
        .select("*, fantasy_team:fantasy_teams(team_name), player:players(name)")
        .eq("gameweek_id", latestTotw.gameweek_id)
    : { data: [] as any[] };

  const { data: allScores } = await supabase.from("fantasy_team_gameweek_scores").select("fantasy_team_id, net_points, gameweek:gameweeks(number)");
  const { data: teams } = await supabase.from("fantasy_teams").select("id, team_name");
  const teamName = new Map((teams ?? []).map((t: any) => [t.id, t.team_name]));

  const cumulative = new Map<string, number>();
  (allScores ?? []).forEach((s: any) => cumulative.set(s.fantasy_team_id, (cumulative.get(s.fantasy_team_id) ?? 0) + s.net_points));
  const leaderboard = [...cumulative.entries()].sort((a, b) => b[1] - a[1]);
  const leader = leaderboard[0];

  // Biggest movers: compare cumulative rank as of the latest gameweek vs the one before.
  const gwNumbers = [...new Set((allScores ?? []).map((s: any) => s.gameweek?.number).filter(Boolean))].sort((a: any, b: any) => a - b);
  let movers: { team: string; change: number }[] = [];
  if (gwNumbers.length >= 2) {
    const latestGwNum = gwNumbers[gwNumbers.length - 1];
    const priorGwNum = gwNumbers[gwNumbers.length - 2];
    const rankAt = (uptoGw: number) => {
      const totals = new Map<string, number>();
      (allScores ?? []).forEach((s: any) => {
        if ((s.gameweek?.number ?? 0) <= uptoGw) totals.set(s.fantasy_team_id, (totals.get(s.fantasy_team_id) ?? 0) + s.net_points);
      });
      return [...totals.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id);
    };
    const latestRank = rankAt(latestGwNum);
    const priorRank = rankAt(priorGwNum);
    movers = latestRank
      .map((id, i) => {
        const priorIdx = priorRank.indexOf(id);
        return { team: teamName.get(id) ?? "—", change: priorIdx === -1 ? 0 : priorIdx - i };
      })
      .sort((a, b) => b.change - a.change)
      .slice(0, 3);
  }

  const { data: topPlayersRaw } = await supabase.from("fantasy_points").select("player_id, points");
  const totalsByPlayer = new Map<string, number>();
  (topPlayersRaw ?? []).forEach((p: any) => totalsByPlayer.set(p.player_id, (totalsByPlayer.get(p.player_id) ?? 0) + p.points));
  const topPlayerIds = [...totalsByPlayer.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const { data: topPlayerRows } = topPlayerIds.length
    ? await supabase.from("players").select("id, name, team:teams(name)").in("id", topPlayerIds.map(([id]) => id))
    : { data: [] as any[] };
  const topPlayers = topPlayerIds.map(([id, pts]) => ({
    ...(topPlayerRows ?? []).find((p: any) => p.id === id),
    points: pts,
  }));

  const { data: latestResults } = await supabase
    .from("fixtures")
    .select("*, home_team:teams!fixtures_home_team_id_fkey(*), away_team:teams!fixtures_away_team_id_fkey(*)")
    .eq("is_final", true)
    .order("kickoff_at", { ascending: false })
    .limit(4);

  return (
    <div>
      <section className="border-b border-pitch-border bg-gradient-to-br from-violet-950/40 via-pitch to-pitch">
        <div className="mx-auto max-w-6xl px-4 py-12">
          <div className="flex items-center gap-2 text-emerald-400">
            <Trophy size={20} />
            <span className="text-sm font-bold uppercase tracking-widest">Gullhaug Fantasy Football</span>
          </div>
          <h1 className="mt-3 max-w-2xl font-display text-4xl font-black leading-tight text-white md:text-5xl">
            Build your squad. Pick your captain. Beat your mates.
          </h1>
          <p className="mt-3 max-w-xl text-slate-400">
            Fantasy football for Gullhaug 1, Gullhaug 2, and every team we play in our leagues.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/squad" className="rounded-lg bg-emerald-500 px-5 py-3 font-bold text-slate-950 hover:bg-emerald-400">
              Build my team
            </Link>
            <Link href="/statistics" className="rounded-lg border border-pitch-border px-5 py-3 font-bold text-white hover:bg-pitch-surface">
              See statistics
            </Link>
            <Link href="/rules" className="rounded-lg border border-pitch-border px-5 py-3 font-bold text-white hover:bg-pitch-surface">
              Read the rules
            </Link>
          </div>

          {nextDeadlineGw && (
            <div className="mt-6 max-w-xs">
              <DeadlineCountdown deadline={nextDeadlineGw.deadline_at} gameweekNumber={nextDeadlineGw.number} />
            </div>
          )}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-10 grid gap-6 md:grid-cols-2">
        <div>
          <h2 className="font-display text-xl font-bold text-white">League leader</h2>
          <div className="mt-3 rounded-xl border border-pitch-border bg-pitch-surface p-4">
            {leader ? (
              <>
                <div className="text-lg font-bold text-white">{teamName.get(leader[0])}</div>
                <div className="font-mono text-2xl font-black text-emerald-400">{leader[1]} pts</div>
              </>
            ) : (
              <p className="text-sm text-slate-500">No scores yet.</p>
            )}
          </div>
        </div>

        <div>
          <h2 className="font-display text-xl font-bold text-white">Biggest movers</h2>
          <div className="mt-3 space-y-2">
            {movers.map((m, i) => (
              <div key={i} className="flex items-center justify-between rounded-xl border border-pitch-border bg-pitch-surface px-4 py-2.5">
                <span className="text-sm font-semibold text-white">{m.team}</span>
                <span className={`flex items-center gap-1 text-sm font-bold ${m.change > 0 ? "text-emerald-400" : m.change < 0 ? "text-rose-400" : "text-slate-500"}`}>
                  {m.change > 0 ? <TrendingUp size={14} /> : m.change < 0 ? <TrendingDown size={14} /> : null}
                  {m.change > 0 ? `+${m.change}` : m.change}
                </span>
              </div>
            ))}
            {movers.length === 0 && <p className="text-sm text-slate-500">Need at least 2 gameweeks of data.</p>}
          </div>
        </div>
      </section>

      {latestAwards && latestAwards.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 pb-10">
          <h2 className="font-display text-xl font-bold text-white">Weekly Awards — Gameweek {latestTotw?.gameweek?.number}</h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 md:grid-cols-3">
            {latestAwards.map((a: any) => (
              <div key={a.id} className="rounded-xl border border-pitch-border bg-pitch-surface p-3">
                <div className="text-xs font-bold text-violet-300">{AWARD_LABELS[a.award_type] ?? a.award_type}</div>
                <div className="mt-1 text-sm font-semibold text-white">{a.fantasy_team?.team_name ?? a.player?.name}</div>
                <div className="text-xs text-slate-500">{a.value_points} pts</div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="mx-auto max-w-6xl px-4 pb-10">
        <h2 className="font-display text-xl font-bold text-white">Top players</h2>
        <div className="mt-3 divide-y divide-pitch-border rounded-xl border border-pitch-border bg-pitch-surface">
          {topPlayers.map((p: any, i) => (
            <div key={p.id ?? i} className="flex items-center justify-between px-4 py-2.5">
              <div className="flex items-center gap-3">
                <span className="w-5 text-xs font-bold text-slate-600">{i + 1}</span>
                <div>
                  <div className="text-sm font-semibold text-white">{p.name}</div>
                  <div className="text-xs text-slate-500">{p.team?.name}</div>
                </div>
              </div>
              <span className="font-mono text-sm font-bold text-emerald-400">{p.points} p</span>
            </div>
          ))}
          {topPlayers.length === 0 && <p className="px-4 py-3 text-sm text-slate-500">No points recorded yet.</p>}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-6">
        <h2 className="font-display text-xl font-bold text-white">
          {currentGw ? `Fixtures — Gameweek ${currentGw.number}` : "No active gameweek"}
        </h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {(fixtures ?? []).map((f: any) => (
            <div key={f.id} className="rounded-xl border border-pitch-border bg-pitch-surface p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-semibold text-white">
                  <Shield size={14} className="text-slate-500" />
                  {f.home_team?.name}
                  <FDRBadge rating={f.home_fdr} />
                </div>
                <span className="font-mono text-xs text-slate-500">
                  {f.is_final ? `${f.home_score}–${f.away_score}` : new Date(f.kickoff_at).toLocaleDateString("en-GB")}
                </span>
              </div>
              <div className="mt-2 flex items-center gap-2 text-sm font-semibold text-white">
                <Shield size={14} className="text-slate-500" />
                {f.away_team?.name}
                <FDRBadge rating={f.away_fdr} />
              </div>
            </div>
          ))}
          {(!fixtures || fixtures.length === 0) && <p className="text-sm text-slate-500">No fixtures added yet.</p>}
        </div>
      </section>

      {latestResults && latestResults.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 py-6">
          <h2 className="font-display text-xl font-bold text-white">Latest results</h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {latestResults.map((f: any) => (
              <div key={f.id} className="flex items-center justify-between rounded-xl border border-pitch-border bg-pitch-surface px-4 py-2.5 text-sm">
                <span className="text-white">{f.home_team?.name}</span>
                <span className="font-mono font-bold text-emerald-400">{f.home_score}–{f.away_score}</span>
                <span className="text-white">{f.away_team?.name}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {latestTotw && (
        <section className="mx-auto max-w-6xl px-4 pb-16">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-xl font-bold text-white">
              Team of the Week — Gameweek {latestTotw.gameweek?.number}
            </h2>
            <Link href="/team-of-the-week" className="flex items-center gap-1 text-sm font-semibold text-violet-400">
              See all <ArrowRight size={14} />
            </Link>
          </div>
          <div className="mt-3 rounded-xl border border-pitch-border bg-gradient-to-br from-violet-600/20 to-emerald-600/20 p-4">
            <div className="text-sm text-slate-300">Formation: {latestTotw.formation}</div>
            <div className="mt-1 font-mono text-3xl font-black text-white">{latestTotw.total_points} points</div>
          </div>
        </section>
      )}
    </div>
  );
}
