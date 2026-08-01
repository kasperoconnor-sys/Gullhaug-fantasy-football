import { createClient } from "@/lib/supabase/server";

export const revalidate = 300;

export default async function RecordsPage() {
  const supabase = createClient();

  const { data: allScores } = await supabase
    .from("fantasy_team_gameweek_scores")
    .select("*, fantasy_team:fantasy_teams(team_name), gameweek:gameweeks(number)")
    .order("net_points", { ascending: false })
    .limit(1);

  const { data: allScoresByGw } = await supabase.from("fantasy_team_gameweek_scores").select("gameweek_id, net_points");
  const byGw = new Map<string, number[]>();
  (allScoresByGw ?? []).forEach((s: any) => {
    const list = byGw.get(s.gameweek_id) ?? [];
    list.push(s.net_points);
    byGw.set(s.gameweek_id, list);
  });
  let biggestMargin = 0;
  byGw.forEach((points) => {
    const sorted = [...points].sort((a, b) => b - a);
    if (sorted.length >= 2) biggestMargin = Math.max(biggestMargin, sorted[0] - sorted[1]);
  });

  const { data: players } = await supabase.from("players").select("id, name, position");
  const { data: allFantasyPoints } = await supabase.from("fantasy_points").select("player_id, points, scouting_bonus_applied");
  const totalsByPlayer = new Map<string, number>();
  const scoutingByPlayer = new Map<string, number>();
  (allFantasyPoints ?? []).forEach((fp: any) => {
    totalsByPlayer.set(fp.player_id, (totalsByPlayer.get(fp.player_id) ?? 0) + fp.points);
    if (fp.scouting_bonus_applied) scoutingByPlayer.set(fp.player_id, (scoutingByPlayer.get(fp.player_id) ?? 0) + 1);
  });

  function topByPosition(pos: string): { name: string; points: number } | null {
    let best: { name: string; points: number } | null = null;
    (players ?? []).filter((p: any) => p.position === pos).forEach((p: any) => {
      const total = totalsByPlayer.get(p.id) ?? 0;
      if (!best || total > best.points) best = { name: p.name, points: total };
    });
    return best;
  }

  const { data: statsRows } = await supabase.from("player_match_stats").select("player_id, goals, clean_sheet");
  const goalsByPlayer = new Map<string, number>();
  const csByPlayer = new Map<string, number>();
  (statsRows ?? []).forEach((s: any) => {
    goalsByPlayer.set(s.player_id, (goalsByPlayer.get(s.player_id) ?? 0) + s.goals);
    if (s.clean_sheet) csByPlayer.set(s.player_id, (csByPlayer.get(s.player_id) ?? 0) + 1);
  });
  const nameById = new Map((players ?? []).map((p: any) => [p.id, p.name]));

  const mostGoals = [...goalsByPlayer.entries()].sort((a, b) => b[1] - a[1])[0];
  const mostCleanSheets = [...csByPlayer.entries()].sort((a, b) => b[1] - a[1])[0];
  const mostScoutingBonuses = [...scoutingByPlayer.entries()].sort((a, b) => b[1] - a[1])[0];

  // Most captain points — highest single-instance doubled captain score.
  const { data: lineups } = await supabase.from("gameweek_lineups").select("captain_player_id, fantasy_team_id, gameweek_id");
  let bestCaptainInstance: { player: string; points: number; team: string } | null = null;
  for (const l of lineups ?? []) {
    if (!l.captain_player_id) continue;
    const { data: fp } = await supabase.from("fantasy_points").select("points").eq("player_id", l.captain_player_id).eq("gameweek_id", l.gameweek_id).maybeSingle();
    const doubled = (fp?.points ?? 0) * 2;
    if (!bestCaptainInstance || doubled > bestCaptainInstance.points) {
      const { data: team } = await supabase.from("fantasy_teams").select("team_name").eq("id", l.fantasy_team_id).single();
      bestCaptainInstance = { player: nameById.get(l.captain_player_id) ?? "—", points: doubled, team: team?.team_name ?? "—" };
    }
  }

  const gk = topByPosition("GK");
  const def = topByPosition("DEF");
  const mid = topByPosition("MID");
  const fwd = topByPosition("FWD");

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="font-display text-2xl font-black text-slate-900">Season Records</h1>
      <p className="mt-1 text-sm text-slate-500">All-time bests across every gameweek played.</p>

      <div className="mt-4 space-y-2">
        <Record label="Highest gameweek score ever" value={allScores?.[0] ? `${allScores[0].net_points} pts — ${allScores[0].fantasy_team?.team_name} (GW${allScores[0].gameweek?.number})` : "—"} />
        <Record label="Biggest winning margin" value={biggestMargin > 0 ? `${biggestMargin} pts` : "—"} />
        <Record label="Highest scoring goalkeeper" value={gk ? `${gk.name} — ${gk.points} pts` : "—"} />
        <Record label="Highest scoring defender" value={def ? `${def.name} — ${def.points} pts` : "—"} />
        <Record label="Highest scoring midfielder" value={mid ? `${mid.name} — ${mid.points} pts` : "—"} />
        <Record label="Highest scoring forward" value={fwd ? `${fwd.name} — ${fwd.points} pts` : "—"} />
        <Record label="Most goals" value={mostGoals ? `${nameById.get(mostGoals[0])} — ${mostGoals[1]} goals` : "—"} />
        <Record label="Most clean sheets" value={mostCleanSheets ? `${nameById.get(mostCleanSheets[0])} — ${mostCleanSheets[1]}` : "—"} />
        <Record label="Most captain points (single GW)" value={bestCaptainInstance ? `${bestCaptainInstance.player} — ${bestCaptainInstance.points} pts (${bestCaptainInstance.team})` : "—"} />
        <Record label="Most scouting bonuses" value={mostScoutingBonuses ? `${nameById.get(mostScoutingBonuses[0])} — ${mostScoutingBonuses[1]}` : "—"} />
      </div>
    </div>
  );
}

function Record({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-pitch-border bg-pitch-surface px-4 py-3">
      <span className="text-sm text-slate-500">{label}</span>
      <span className="text-right text-sm font-bold text-slate-900">{value}</span>
    </div>
  );
}
