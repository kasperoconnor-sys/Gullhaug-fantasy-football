import { createClient } from "@/lib/supabase/server";
import StatCard from "@/components/StatCard";

export const revalidate = 120;

export default async function StatisticsPage() {
  const supabase = createClient();

  const [
    { data: players },
    { data: allSquadRows },
    { data: totalTeams },
    { data: fantasyPoints },
    { data: statsRows },
    { data: lineups },
    { data: weeklyAwards },
  ] = await Promise.all([
    supabase.from("players").select("*, team:teams(*)").eq("is_active", true),
    supabase.from("fantasy_squad_players").select("player_id"),
    supabase.from("fantasy_teams").select("id"),
    supabase.from("fantasy_points").select("player_id, points, scouting_bonus_applied"),
    supabase.from("player_match_stats").select("player_id, goals, assists, clean_sheet"),
    supabase.from("gameweek_lineups").select("captain_player_id, vice_captain_player_id"),
    supabase.from("weekly_awards").select("award_type, player_id"),
  ]);

  const managerCount = totalTeams?.length ?? 0;

  const ownershipCount = new Map<string, number>();
  (allSquadRows ?? []).forEach((r) => ownershipCount.set(r.player_id, (ownershipCount.get(r.player_id) ?? 0) + 1));

  const pointsTotal = new Map<string, number>();
  const pointsGames = new Map<string, number>();
  const scoutingCount = new Map<string, number>();
  (fantasyPoints ?? []).forEach((fp) => {
    pointsTotal.set(fp.player_id, (pointsTotal.get(fp.player_id) ?? 0) + fp.points);
    pointsGames.set(fp.player_id, (pointsGames.get(fp.player_id) ?? 0) + 1);
    if (fp.scouting_bonus_applied) scoutingCount.set(fp.player_id, (scoutingCount.get(fp.player_id) ?? 0) + 1);
  });

  const goalsTotal = new Map<string, number>();
  const assistsTotal = new Map<string, number>();
  const cleanSheetsTotal = new Map<string, number>();
  const hatTricks = new Map<string, number>();
  const fiveGoalGames = new Map<string, number>();
  (statsRows ?? []).forEach((s) => {
    goalsTotal.set(s.player_id, (goalsTotal.get(s.player_id) ?? 0) + s.goals);
    assistsTotal.set(s.player_id, (assistsTotal.get(s.player_id) ?? 0) + s.assists);
    if (s.clean_sheet) cleanSheetsTotal.set(s.player_id, (cleanSheetsTotal.get(s.player_id) ?? 0) + 1);
    if (s.goals >= 3) hatTricks.set(s.player_id, (hatTricks.get(s.player_id) ?? 0) + 1);
    if (s.goals >= 5) fiveGoalGames.set(s.player_id, (fiveGoalGames.get(s.player_id) ?? 0) + 1);
  });

  const captainCount = new Map<string, number>();
  const viceCount = new Map<string, number>();
  (lineups ?? []).forEach((l) => {
    if (l.captain_player_id) captainCount.set(l.captain_player_id, (captainCount.get(l.captain_player_id) ?? 0) + 1);
    if (l.vice_captain_player_id) viceCount.set(l.vice_captain_player_id, (viceCount.get(l.vice_captain_player_id) ?? 0) + 1);
  });

  const potwCount = new Map<string, number>();
  (weeklyAwards ?? []).forEach((a) => {
    if (a.player_id && (a.award_type === "captain_of_the_week" || a.award_type === "best_differential" || a.award_type === "best_defence" || a.award_type === "highest_attack")) {
      potwCount.set(a.player_id, (potwCount.get(a.player_id) ?? 0) + 1);
    }
  });

  const enriched = (players ?? []).map((p) => {
    const total = pointsTotal.get(p.id) ?? 0;
    const games = pointsGames.get(p.id) ?? 0;
    return {
      ...p,
      ownershipPct: managerCount > 0 ? ((ownershipCount.get(p.id) ?? 0) / managerCount) * 100 : 0,
      totalPoints: total,
      avgPoints: games > 0 ? total / games : 0,
      valueScore: p.price > 0 ? total / p.price : 0,
      goals: goalsTotal.get(p.id) ?? 0,
      assists: assistsTotal.get(p.id) ?? 0,
      cleanSheets: cleanSheetsTotal.get(p.id) ?? 0,
      hatTricks: hatTricks.get(p.id) ?? 0,
      fiveGoalGames: fiveGoalGames.get(p.id) ?? 0,
      scoutingBonuses: scoutingCount.get(p.id) ?? 0,
      captainCount: captainCount.get(p.id) ?? 0,
      viceCount: viceCount.get(p.id) ?? 0,
      potwCount: potwCount.get(p.id) ?? 0,
    };
  });

  const top = (key: keyof (typeof enriched)[number], n = 8) => [...enriched].sort((a: any, b: any) => b[key] - a[key]).slice(0, n);

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 pb-6">
      <h1 className="font-display text-2xl font-black text-slate-900">Stats</h1>
      <p className="mt-1 text-sm text-slate-500">Every category, updated as results come in.</p>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard label="Managers" value={managerCount} />
        <StatCard label="Players tracked" value={players?.length ?? 0} accent="emerald" />
        <StatCard label="Differentials" value={enriched.filter((p) => p.ownershipPct < 5 && p.totalPoints > 0).length} />
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <Board title="Top Scorers" rows={top("goals").filter((p: any) => p.goals > 0)} valueKey="goals" suffix=" goals" />
        <Board title="Top Assists" rows={top("assists").filter((p: any) => p.assists > 0)} valueKey="assists" suffix=" assists" />
        <Board title="Most Clean Sheets" rows={top("cleanSheets").filter((p: any) => p.cleanSheets > 0)} valueKey="cleanSheets" suffix="" />
        <Board title="Highest Fantasy Points" rows={top("totalPoints").filter((p: any) => p.totalPoints > 0)} valueKey="totalPoints" suffix=" pts" />
        <Board title="Highest Average" rows={top("avgPoints").filter((p: any) => p.avgPoints > 0)} valueKey="avgPoints" suffix=" pts/gw" decimals />
        <Board title="Best Value Players" rows={top("valueScore").filter((p: any) => p.valueScore > 0)} valueKey="valueScore" suffix=" pts/M" decimals />
        <Board title="Most Selected" rows={top("ownershipPct")} valueKey="ownershipPct" suffix="%" decimals />
        <Board title="Most Captained" rows={top("captainCount").filter((p: any) => p.captainCount > 0)} valueKey="captainCount" suffix=" times" />
        <Board title="Most Vice Captained" rows={top("viceCount").filter((p: any) => p.viceCount > 0)} valueKey="viceCount" suffix=" times" />
        <Board title="Highest Scouting Bonuses" rows={top("scoutingBonuses").filter((p: any) => p.scoutingBonuses > 0)} valueKey="scoutingBonuses" suffix="" />
        <Board title="Most Hat-tricks" rows={top("hatTricks").filter((p: any) => p.hatTricks > 0)} valueKey="hatTricks" suffix="" />
        <Board title="Most 5-Goal Games" rows={top("fiveGoalGames").filter((p: any) => p.fiveGoalGames > 0)} valueKey="fiveGoalGames" suffix="" />
        <Board title="Most Weekly Awards" rows={top("potwCount").filter((p: any) => p.potwCount > 0)} valueKey="potwCount" suffix="" />
      </div>
    </div>
  );
}

function Board({ title, rows, valueKey, suffix, decimals }: { title: string; rows: any[]; valueKey: string; suffix: string; decimals?: boolean }) {
  return (
    <div>
      <h2 className="text-sm font-bold text-slate-500">{title}</h2>
      <div className="mt-2 divide-y divide-pitch-border rounded-xl border border-pitch-border bg-pitch-surface">
        {rows.map((p, i) => (
          <div key={p.id} className="flex items-center justify-between px-4 py-2.5">
            <div className="flex items-center gap-3">
              <span className="w-5 text-xs font-bold text-slate-400">{i + 1}</span>
              <div>
                <div className="text-sm font-semibold text-slate-900">{p.name}</div>
                <div className="text-xs text-slate-500">{p.team?.name}</div>
              </div>
            </div>
            <span className="font-mono text-sm font-bold text-emerald-600">
              {decimals ? p[valueKey].toFixed(1) : p[valueKey]}
              {suffix}
            </span>
          </div>
        ))}
        {rows.length === 0 && <p className="px-4 py-3 text-sm text-slate-500">No data yet.</p>}
      </div>
    </div>
  );
}
