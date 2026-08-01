import { createClient } from "@/lib/supabase/server";
import DeadlineCountdown from "@/components/DeadlineCountdown";
import Link from "next/link";
import { ArrowRight, Newspaper, Star, Award, TrendingUp, Radio } from "lucide-react";

export const revalidate = 30;

export default async function HomePage() {
  const supabase = createClient();
  const { data: userData } = await supabase.auth.getUser();

  const [{ data: nextDeadlineGw }, { data: currentGw }] = await Promise.all([
    supabase.from("gameweeks").select("*").in("status", ["upcoming", "open"]).order("number", { ascending: true }).limit(1).maybeSingle(),
    supabase.from("gameweeks").select("*").in("status", ["open", "in_progress"]).order("number", { ascending: true }).limit(1).maybeSingle(),
  ]);

  // Personalized greeting + rank
  let displayName: string | null = null;
  let myTeamId: string | null = null;
  let myRank: number | null = null;
  let myGwPoints: number | null = null;
  let gapText: string | null = null;

  const { data: allScores } = await supabase.from("fantasy_team_gameweek_scores").select("fantasy_team_id, net_points, gameweek:gameweeks(number)");
  const { data: teams } = await supabase.from("fantasy_teams").select("id, team_name, user_id");
  const teamName = new Map((teams ?? []).map((t: any) => [t.id, t.team_name]));

  const cumulative = new Map<string, number>();
  (allScores ?? []).forEach((s: any) => cumulative.set(s.fantasy_team_id, (cumulative.get(s.fantasy_team_id) ?? 0) + s.net_points));
  const leaderboard = [...cumulative.entries()].sort((a, b) => b[1] - a[1]);
  const leader = leaderboard[0];

  if (userData.user) {
    const [{ data: profile }, { data: myTeam }] = await Promise.all([
      supabase.from("profiles").select("display_name").eq("id", userData.user.id).single(),
      supabase.from("fantasy_teams").select("id").eq("user_id", userData.user.id).maybeSingle(),
    ]);
    displayName = profile?.display_name?.split(" ")[0] ?? null;
    myTeamId = myTeam?.id ?? null;

    if (myTeamId) {
      myRank = leaderboard.findIndex(([id]) => id === myTeamId) + 1;
      if (myRank === 0) myRank = null;

      const gwNumbers = [...new Set((allScores ?? []).map((s: any) => s.gameweek?.number).filter(Boolean))].sort((a: any, b: any) => b - a);
      if (gwNumbers.length > 0) {
        const latestGw = gwNumbers[0];
        const myLatest = (allScores ?? []).find((s: any) => s.fantasy_team_id === myTeamId && s.gameweek?.number === latestGw);
        myGwPoints = myLatest?.net_points ?? null;
      }

      const myTotal = cumulative.get(myTeamId) ?? 0;
      if (leader && leader[0] === myTeamId) {
        const second = leaderboard[1];
        gapText = second ? `+${myTotal - second[1]}` : "—";
      } else if (leader) {
        gapText = `-${leader[1] - myTotal}`;
      }
    }
  }

  // Live fixtures
  let liveCount = 0;
  if (currentGw?.status === "in_progress") {
    const { count } = await supabase.from("fixtures").select("*", { count: "exact", head: true }).eq("gameweek_id", currentGw.id).eq("is_final", false).lte("kickoff_at", new Date().toISOString());
    liveCount = count ?? 0;
  }

  // Featured story — rule-based highlight of the latest completed gameweek (not AI-generated).
  let headline: string | null = null;
  const { data: latestCompletedGw } = await supabase.from("gameweeks").select("*").eq("status", "completed").order("number", { ascending: false }).limit(1).maybeSingle();
  if (latestCompletedGw) {
    const { data: topScore } = await supabase
      .from("fantasy_team_gameweek_scores")
      .select("*, fantasy_team:fantasy_teams(team_name)")
      .eq("gameweek_id", latestCompletedGw.id)
      .order("net_points", { ascending: false })
      .limit(1)
      .maybeSingle();
    const { data: bestCaptainLineup } = await supabase.from("gameweek_lineups").select("captain_player_id, fantasy_team:fantasy_teams(team_name)").eq("gameweek_id", latestCompletedGw.id);
    let bestCaptainName: string | null = null;
    let bestCaptainPts = 0;
    for (const l of bestCaptainLineup ?? []) {
      if (!l.captain_player_id) continue;
      const { data: fp } = await supabase.from("fantasy_points").select("points, player:players(name)").eq("player_id", l.captain_player_id).eq("gameweek_id", latestCompletedGw.id).maybeSingle();
      const doubled = (fp?.points ?? 0) * 2;
      if (doubled > bestCaptainPts) {
        bestCaptainPts = doubled;
        bestCaptainName = (fp?.player as any)?.name ?? null;
      }
    }
    if (bestCaptainName && topScore) {
      headline = `${bestCaptainName}'s captain pick banked ${bestCaptainPts} points as ${(topScore.fantasy_team as any)?.team_name} topped Gameweek ${latestCompletedGw.number} with ${topScore.net_points} points.`;
    } else if (topScore) {
      headline = `${(topScore.fantasy_team as any)?.team_name} topped Gameweek ${latestCompletedGw.number} with ${topScore.net_points} points.`;
    }
  }

  const { data: latestTotw } = await supabase.from("team_of_the_week").select("*, gameweek:gameweeks(*)").order("created_at", { ascending: false }).limit(1).maybeSingle();

  return (
    <div className="mx-auto max-w-4xl px-4 py-4">
      {/* Greeting + rank strip */}
      {displayName ? (
        <div className="rounded-2xl border border-pitch-border bg-white p-4 shadow-card">
          <p className="font-display text-lg font-bold text-slate-900">👋 Hi {displayName}!</p>
          {nextDeadlineGw && (
            <p className="mt-0.5 text-xs text-slate-500">
              GW{nextDeadlineGw.number} • Deadline in{" "}
              <CountdownInline deadline={nextDeadlineGw.deadline_at} />
            </p>
          )}

          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <MiniStat label="Rank" value={myRank ? `#${myRank}` : "—"} />
            <MiniStat label="GW Points" value={myGwPoints ?? "—"} />
            <MiniStat label={gapText?.startsWith("+") ? "Lead" : "Gap to leader"} value={gapText ?? "—"} />
          </div>

          <div className="mt-3 flex gap-2">
            <Link href="/pick-team" className="flex-1 rounded-lg bg-emerald-500 py-2 text-center text-sm font-bold text-slate-950 hover:bg-emerald-400">
              Pick Team
            </Link>
            <Link href="/transfers" className="flex-1 rounded-lg bg-violet-600 py-2 text-center text-sm font-bold text-white hover:bg-violet-500">
              Transfers
            </Link>
          </div>
        </div>
      ) : (
        nextDeadlineGw && <DeadlineCountdown deadline={nextDeadlineGw.deadline_at} gameweekNumber={nextDeadlineGw.number} />
      )}

      {/* Featured story */}
      {headline && (
        <Link href="/statistics" className="mt-4 block rounded-2xl border border-pitch-border bg-pitch-surface p-4 hover:border-violet-500/40">
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-violet-400">
            <Newspaper size={13} /> Featured Story
          </div>
          <p className="mt-1.5 text-sm font-semibold text-slate-900">"{headline}"</p>
          <span className="mt-1 inline-block text-xs font-semibold text-violet-400">Read more →</span>
        </Link>
      )}

      {/* Quick cards */}
      <div className="mt-4 grid grid-cols-3 gap-2">
        <QuickCard href="/team-of-the-week" icon={<Star size={18} className="text-amber-400" />} label="Team of the Week" />
        <QuickCard href="/statistics" icon={<Award size={18} className="text-violet-400" />} label="Weekly Awards" />
        <QuickCard href="/leagues" icon={<TrendingUp size={18} className="text-emerald-400" />} label="Biggest Movers" />
      </div>

      {/* Live fixtures */}
      {liveCount > 0 && (
        <Link href="/fixtures" className="mt-4 flex items-center justify-between rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 hover:bg-rose-500/15">
          <span className="flex items-center gap-2 text-sm font-bold text-rose-300">
            <Radio size={16} className="animate-pulse" /> {liveCount} matches live
          </span>
          <span className="text-xs font-semibold text-rose-300">View →</span>
        </Link>
      )}

      {/* League snapshot */}
      <div className="mt-4 rounded-2xl border border-pitch-border bg-pitch-surface p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-700">League Snapshot</h2>
          <Link href="/leagues" className="flex items-center gap-0.5 text-[11px] font-semibold text-violet-400">
            View Table <ArrowRight size={11} />
          </Link>
        </div>
        <div className="mt-2 space-y-1.5">
          {leaderboard.slice(0, 3).map(([id, pts], i) => (
            <div key={id} className="flex items-center justify-between text-sm">
              <span className="text-slate-900">
                {i + 1}. {teamName.get(id)}
              </span>
              <span className="font-mono font-bold text-emerald-400">{pts}</span>
            </div>
          ))}
          {leaderboard.length === 0 && <p className="text-sm text-slate-500">No scores yet.</p>}
        </div>
      </div>

      {latestTotw && (
        <p className="mt-3 text-center text-xs text-slate-500">
          Latest Team of the Week: Gameweek {latestTotw.gameweek?.number} — {latestTotw.total_points} pts
        </p>
      )}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg bg-pitch/60 py-2">
      <div className="font-mono text-lg font-black text-slate-900">{value}</div>
      <div className="text-[10px] text-slate-500">{label}</div>
    </div>
  );
}

function QuickCard({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link href={href} className="flex flex-col items-center gap-1.5 rounded-xl border border-pitch-border bg-pitch-surface px-2 py-4 text-center hover:border-violet-500/40">
      {icon}
      <span className="text-[11px] font-semibold text-slate-700">{label}</span>
    </Link>
  );
}

function CountdownInline({ deadline }: { deadline: string }) {
  const diff = new Date(deadline).getTime() - Date.now();
  if (diff <= 0) return <>closed</>;
  const d = Math.floor(diff / (1000 * 60 * 60 * 24));
  const h = Math.floor((diff / (1000 * 60 * 60)) % 24);
  return (
    <>
      {d}d {h}h
    </>
  );
}
