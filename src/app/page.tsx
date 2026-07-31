import { createClient } from "@/lib/supabase/server";
import FDRBadge from "@/components/FDRBadge";
import DeadlineCountdown from "@/components/DeadlineCountdown";
import Link from "next/link";
import { Shield, ArrowRight, TrendingUp, TrendingDown } from "lucide-react";

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

  const { data: currentGw } = await supabase.from("gameweeks").select("*").in("status", ["open", "in_progress"]).order("number", { ascending: true }).limit(1).maybeSingle();
  const { data: nextDeadlineGw } = await supabase.from("gameweeks").select("*").in("status", ["upcoming", "open"]).order("number", { ascending: true }).limit(1).maybeSingle();

  const { data: fixtures } = currentGw
    ? await supabase.from("fixtures").select("*, home_team:teams!fixtures_home_team_id_fkey(*), away_team:teams!fixtures_away_team_id_fkey(*)").eq("gameweek_id", currentGw.id).order("kickoff_at", { ascending: true }).limit(4)
    : { data: [] as any[] };

  const { data: latestTotw } = await supabase.from("team_of_the_week").select("*, gameweek:gameweeks(*)").order("created_at", { ascending: false }).limit(1).maybeSingle();
  const { data: latestAwards } = latestTotw
    ? await supabase.from("weekly_awards").select("*, fantasy_team:fantasy_teams(team_name), player:players(name)").eq("gameweek_id", latestTotw.gameweek_id).limit(3)
    : { data: [] as any[] };

  const { data: allScores } = await supabase.from("fantasy_team_gameweek_scores").select("fantasy_team_id, net_points, gameweek:gameweeks(number)");
  const { data: teams } = await supabase.from("fantasy_teams").select("id, team_name");
  const teamName = new Map((teams ?? []).map((t: any) => [t.id, t.team_name]));

  const cumulative = new Map<string, number>();
  (allScores ?? []).forEach((s: any) => cumulative.set(s.fantasy_team_id, (cumulative.get(s.fantasy_team_id) ?? 0) + s.net_points));
  const leaderboard = [...cumulative.entries()].sort((a, b) => b[1] - a[1]);
  const leader = leaderboard[0];

  const gwNumbers = [...new Set((allScores ?? []).map((s: any) => s.gameweek?.number).filter(Boolean))].sort((a: any, b: any) => a - b);
  let movers: { team: string; change: number }[] = [];
  if (gwNumbers.length >= 2) {
    const latestGwNum = gwNumbers[gwNumbers.length - 1];
    const priorGwNum = gwNumbers[gwNumbers.length - 2];
    const rankAt = (uptoGw: number) => {
      const totals = new Map<string, number>();
      (allScores ?? []).forEach((s: any) => { if ((s.gameweek?.number ?? 0) <= uptoGw) totals.set(s.fantasy_team_id, (totals.get(s.fantasy_team_id) ?? 0) + s.net_points); });
      return [...totals.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id);
    };
    const latestRank = rankAt(latestGwNum);
    const priorRank = rankAt(priorGwNum);
    movers = latestRank.map((id, i) => ({ team: teamName.get(id) ?? "—", change: priorRank.indexOf(id) === -1 ? 0 : priorRank.indexOf(id) - i })).sort((a, b) => b.change - a.change).slice(0, 3);
  }

  const { data: topPlayersRaw } = await supabase.from("fantasy_points").select("player_id, points");
  const totalsByPlayer = new Map<string, number>();
  (topPlayersRaw ?? []).forEach((p: any) => totalsByPlayer.set(p.player_id, (totalsByPlayer.get(p.player_id) ?? 0) + p.points));
  const topPlayerIds = [...totalsByPlayer.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const { data: topPlayerRows } = topPlayerIds.length ? await supabase.from("players").select("id, name, team:teams(name)").in("id", topPlayerIds.map(([id]) => id)) : { data: [] as any[] };
  const topPlayers = topPlayerIds.map(([id, pts]) => ({ ...(topPlayerRows ?? []).find((p: any) => p.id === id), points: pts }));

  const { data: latestResults } = await supabase.from("fixtures").select("*, home_team:teams!fixtures_home_team_id_fkey(*), away_team:teams!fixtures_away_team_id_fkey(*)").eq("is_final", true).order("kickoff_at", { ascending: false }).limit(3);

  // Transfer Trends — most transferred-in players in the most recent gameweek with transfer activity.
  const { data: recentTransfers } = await supabase.from("transfers").select("player_in_id, created_at").order("created_at", { ascending: false }).limit(50);
  const transferInCounts = new Map<string, number>();
  (recentTransfers ?? []).forEach((t: any) => transferInCounts.set(t.player_in_id, (transferInCounts.get(t.player_in_id) ?? 0) + 1));
  const trendIds = [...transferInCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
  const { data: trendPlayers } = trendIds.length ? await supabase.from("players").select("id, name").in("id", trendIds.map(([id]) => id)) : { data: [] as any[] };
  const trends = trendIds.map(([id, count]) => ({ name: (trendPlayers ?? []).find((p: any) => p.id === id)?.name ?? "—", count }));

  // Lightweight News Feed — recent achievement unlocks across everyone.
  const { data: recentNews } = await supabase.from("manager_achievements").select("*, fantasy_team:fantasy_teams(team_name), achievement:achievements(name, icon)").order("unlocked_at", { ascending: false }).limit(4);

  return (
    <div className="mx-auto max-w-6xl px-4 py-4">
      {nextDeadlineGw && (
        <div className="mb-4">
          <DeadlineCountdown deadline={nextDeadlineGw.deadline_at} gameweekNumber={nextDeadlineGw.number} />
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Card title="League leader" href="/leagues">
          {leader ? (
            <>
              <div className="text-base font-bold text-white">{teamName.get(leader[0])}</div>
              <div className="font-mono text-xl font-black text-emerald-400">{leader[1]} pts</div>
            </>
          ) : (
            <p className="text-sm text-slate-500">No scores yet.</p>
          )}
        </Card>

        <Card title="Biggest movers" href="/leagues">
          <div className="space-y-1.5">
            {movers.map((m, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <span className="font-semibold text-white">{m.team}</span>
                <span className={`flex items-center gap-1 font-bold ${m.change > 0 ? "text-emerald-400" : m.change < 0 ? "text-rose-400" : "text-slate-500"}`}>
                  {m.change > 0 ? <TrendingUp size={13} /> : m.change < 0 ? <TrendingDown size={13} /> : null}
                  {m.change > 0 ? `+${m.change}` : m.change}
                </span>
              </div>
            ))}
            {movers.length === 0 && <p className="text-sm text-slate-500">Need 2+ gameweeks.</p>}
          </div>
        </Card>

        <Card title="Transfer trends" href="/transfers">
          <div className="space-y-1.5">
            {trends.map((t, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <span className="text-white">{t.name}</span>
                <span className="font-mono font-bold text-violet-400">↑{t.count}</span>
              </div>
            ))}
            {trends.length === 0 && <p className="text-sm text-slate-500">No transfer activity yet.</p>}
          </div>
        </Card>

        {latestAwards && latestAwards.length > 0 && (
          <Card title={`Weekly Awards — GW${latestTotw?.gameweek?.number}`} href="/statistics">
            <div className="space-y-1.5">
              {latestAwards.map((a: any) => (
                <div key={a.id} className="text-sm">
                  <span className="text-violet-300">{AWARD_LABELS[a.award_type] ?? a.award_type}</span>{" "}
                  <span className="font-semibold text-white">— {a.fantasy_team?.team_name ?? a.player?.name}</span>
                </div>
              ))}
            </div>
          </Card>
        )}

        <Card title="Top players" href="/statistics">
          <div className="space-y-1.5">
            {topPlayers.slice(0, 4).map((p: any, i) => (
              <div key={p.id ?? i} className="flex items-center justify-between text-sm">
                <span className="text-white">{p.name}</span>
                <span className="font-mono font-bold text-emerald-400">{p.points}p</span>
              </div>
            ))}
            {topPlayers.length === 0 && <p className="text-sm text-slate-500">No points recorded yet.</p>}
          </div>
        </Card>

        {latestTotw && (
          <Card title={`Team of the Week — GW${latestTotw.gameweek?.number}`} href="/team-of-the-week">
            <div className="text-sm text-slate-300">Formation: {latestTotw.formation}</div>
            <div className="font-mono text-xl font-black text-white">{latestTotw.total_points} pts</div>
          </Card>
        )}

        <Card title={currentGw ? `Fixtures — GW${currentGw.number}` : "No active gameweek"} href="/fixtures">
          <div className="space-y-2">
            {(fixtures ?? []).map((f: any) => (
              <div key={f.id} className="text-xs">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1 font-semibold text-white"><Shield size={11} className="text-slate-500" />{f.home_team?.name}<FDRBadge rating={f.home_fdr} /></span>
                  <span className="font-mono text-slate-500">{f.is_final ? `${f.home_score}–${f.away_score}` : new Date(f.kickoff_at).toLocaleDateString("en-GB")}</span>
                </div>
                <div className="mt-0.5 flex items-center gap-1 font-semibold text-white"><Shield size={11} className="text-slate-500" />{f.away_team?.name}<FDRBadge rating={f.away_fdr} /></div>
              </div>
            ))}
            {(!fixtures || fixtures.length === 0) && <p className="text-sm text-slate-500">No fixtures added yet.</p>}
          </div>
        </Card>

        {latestResults && latestResults.length > 0 && (
          <Card title="Latest results" href="/fixtures">
            <div className="space-y-1.5">
              {latestResults.map((f: any) => (
                <div key={f.id} className="flex items-center justify-between text-sm">
                  <span className="text-white">{f.home_team?.name}</span>
                  <span className="font-mono font-bold text-emerald-400">{f.home_score}–{f.away_score}</span>
                  <span className="text-white">{f.away_team?.name}</span>
                </div>
              ))}
            </div>
          </Card>
        )}

        {recentNews && recentNews.length > 0 && (
          <Card title="News feed" href="/achievements">
            <div className="space-y-1.5">
              {recentNews.map((n: any) => (
                <div key={n.id} className="text-xs text-slate-300">
                  {n.achievement?.icon} <span className="font-semibold text-white">{n.fantasy_team?.team_name}</span> unlocked "{n.achievement?.name}"
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

function Card({ title, href, children }: { title: string; href: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-pitch-border bg-pitch-surface p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-slate-300">{title}</h2>
        <Link href={href} className="flex items-center gap-0.5 text-[11px] font-semibold text-violet-400">
          View more <ArrowRight size={11} />
        </Link>
      </div>
      <div className="mt-2">{children}</div>
    </div>
  );
}
