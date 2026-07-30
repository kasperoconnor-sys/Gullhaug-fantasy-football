import { createClient, createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * Archives the current season into the Hall of Fame (champion, runner-up,
 * third place, and every season record), then starts a fresh season row.
 * Squads, budgets, and transfers are NOT reset automatically — that's a
 * deliberate choice so the admin can decide when/how to reset for next
 * season rather than this silently wiping data.
 */
export async function POST() {
  const supabase = createClient();
  const { data: userData } = await supabase.auth.getUser();
  const { data: profile } = userData.user
    ? await supabase.from("profiles").select("is_admin").eq("id", userData.user.id).single()
    : { data: null };
  if (!profile?.is_admin) return NextResponse.json({ error: "Only admins can do this." }, { status: 403 });

  const db = createServiceClient();

  const { data: currentSeason } = await db.from("seasons").select("*").eq("is_current", true).single();
  if (!currentSeason) return NextResponse.json({ error: "No current season found." }, { status: 400 });

  const { data: allScores } = await db
    .from("fantasy_team_gameweek_scores")
    .select("fantasy_team_id, net_points, gameweek_id, gameweek:gameweeks(number, season_id)");
  const inSeason = (allScores ?? []).filter((s: any) => s.gameweek?.season_id === currentSeason.id);

  const cumulative = new Map<string, number>();
  inSeason.forEach((s: any) => cumulative.set(s.fantasy_team_id, (cumulative.get(s.fantasy_team_id) ?? 0) + s.net_points));
  const leaderboard = [...cumulative.entries()].sort((a, b) => b[1] - a[1]);

  const bestGw = [...inSeason].sort((a: any, b: any) => b.net_points - a.net_points)[0];

  // Best captain instance this season.
  const { data: lineups } = await db.from("gameweek_lineups").select("captain_player_id, gameweek_id");
  let bestCaptain: { player_id: string; points: number } | null = null;
  for (const l of lineups ?? []) {
    if (!l.captain_player_id) continue;
    const { data: fp } = await db.from("fantasy_points").select("points").eq("player_id", l.captain_player_id).eq("gameweek_id", l.gameweek_id).maybeSingle();
    const doubled = (fp?.points ?? 0) * 2;
    if (!bestCaptain || doubled > bestCaptain.points) bestCaptain = { player_id: l.captain_player_id, points: doubled };
  }

  const { data: statsRows } = await db.from("player_match_stats").select("player_id, goals, clean_sheet");
  const goalsByPlayer = new Map<string, number>();
  const csByPlayer = new Map<string, number>();
  (statsRows ?? []).forEach((s: any) => {
    goalsByPlayer.set(s.player_id, (goalsByPlayer.get(s.player_id) ?? 0) + s.goals);
    if (s.clean_sheet) csByPlayer.set(s.player_id, (csByPlayer.get(s.player_id) ?? 0) + 1);
  });
  const mostGoals = [...goalsByPlayer.entries()].sort((a, b) => b[1] - a[1])[0];
  const mostCleanSheets = [...csByPlayer.entries()].sort((a, b) => b[1] - a[1])[0];

  await db.from("hall_of_fame").upsert(
    {
      season_id: currentSeason.id,
      champion_team_id: leaderboard[0]?.[0],
      runner_up_team_id: leaderboard[1]?.[0],
      third_place_team_id: leaderboard[2]?.[0],
      highest_total_points: leaderboard[0]?.[1] ?? 0,
      highest_gameweek_score: bestGw?.net_points ?? 0,
      highest_gameweek_team_id: bestGw?.fantasy_team_id,
      highest_gameweek_number: bestGw?.gameweek?.number,
      best_captain_score: bestCaptain?.points ?? 0,
      best_captain_player_id: bestCaptain?.player_id,
      most_goals_player_id: mostGoals?.[0],
      most_goals_count: mostGoals?.[1] ?? 0,
      most_clean_sheets_player_id: mostCleanSheets?.[0],
      most_clean_sheets_count: mostCleanSheets?.[1] ?? 0,
    },
    { onConflict: "season_id" }
  );

  await db.from("seasons").update({ is_current: false, ended_at: new Date().toISOString() }).eq("id", currentSeason.id);

  const nextLabel = String(Number(currentSeason.label) + 1 || Number(currentSeason.label) + 1);
  const { data: newSeason } = await db.from("seasons").insert({ label: nextLabel, is_current: true }).select().single();

  return NextResponse.json({ ok: true, new_season: newSeason?.label });
}
