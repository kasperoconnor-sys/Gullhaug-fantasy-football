/**
 * Generates the six Weekly Awards for a completed gameweek. Safe to
 * re-run — upserts on (gameweek_id, award_type) so recalculating a
 * gameweek's results updates the awards rather than duplicating them.
 */
export async function generateWeeklyAwards(db: any, gameweekId: string) {
  const { data: teamScores } = await db
    .from("fantasy_team_gameweek_scores")
    .select("fantasy_team_id, points, net_points")
    .eq("gameweek_id", gameweekId);
  if (!teamScores || teamScores.length === 0) return;

  const awards: { award_type: string; fantasy_team_id?: string; player_id?: string; value_points: number }[] = [];

  // Manager of the Week — highest net points.
  const topManager = [...teamScores].sort((a: any, b: any) => b.net_points - a.net_points)[0];
  awards.push({ award_type: "manager_of_the_week", fantasy_team_id: topManager.fantasy_team_id, value_points: topManager.net_points });

  // Unluckiest Manager — highest points among teams NOT in first place
  // (biggest score that still didn't win the gameweek).
  const rest = [...teamScores].filter((s: any) => s.fantasy_team_id !== topManager.fantasy_team_id).sort((a: any, b: any) => b.net_points - a.net_points);
  if (rest.length > 0) {
    awards.push({ award_type: "unluckiest_manager", fantasy_team_id: rest[0].fantasy_team_id, value_points: rest[0].net_points });
  }

  // Captain of the Week — highest-scoring captain (post-multiplier) this gameweek.
  const { data: lineups } = await db
    .from("gameweek_lineups")
    .select("fantasy_team_id, captain_player_id")
    .eq("gameweek_id", gameweekId);
  let bestCaptain: { fantasy_team_id: string; player_id: string; points: number } | null = null;
  for (const l of lineups ?? []) {
    if (!l.captain_player_id) continue;
    const { data: fp } = await db.from("fantasy_points").select("points").eq("player_id", l.captain_player_id).eq("gameweek_id", gameweekId).maybeSingle();
    const doubled = (fp?.points ?? 0) * 2;
    if (!bestCaptain || doubled > bestCaptain.points) {
      bestCaptain = { fantasy_team_id: l.fantasy_team_id, player_id: l.captain_player_id, points: doubled };
    }
  }
  if (bestCaptain) {
    awards.push({ award_type: "captain_of_the_week", fantasy_team_id: bestCaptain.fantasy_team_id, player_id: bestCaptain.player_id, value_points: bestCaptain.points });
  }

  // Best Differential — highest-scoring player owned by <5% of managers this gameweek.
  const { data: lowOwnedPoints } = await db.from("fantasy_points").select("player_id, points, scouting_bonus_applied").eq("gameweek_id", gameweekId).eq("scouting_bonus_applied", true).order("points", { ascending: false }).limit(1);
  if (lowOwnedPoints && lowOwnedPoints.length > 0) {
    awards.push({ award_type: "best_differential", player_id: lowOwnedPoints[0].player_id, value_points: lowOwnedPoints[0].points });
  }

  // Best Defence — GK/DEF player with the most points this gameweek.
  const { data: defPlayers } = await db.from("players").select("id").in("position", ["GK", "DEF"]);
  const defIds = (defPlayers ?? []).map((p: any) => p.id);
  if (defIds.length) {
    const { data: bestDef } = await db.from("fantasy_points").select("player_id, points").in("player_id", defIds).eq("gameweek_id", gameweekId).order("points", { ascending: false }).limit(1);
    if (bestDef && bestDef.length > 0) {
      awards.push({ award_type: "best_defence", player_id: bestDef[0].player_id, value_points: bestDef[0].points });
    }
  }

  // Highest Attack — MID/FWD player with the most points this gameweek.
  const { data: attPlayers } = await db.from("players").select("id").in("position", ["MID", "FWD"]);
  const attIds = (attPlayers ?? []).map((p: any) => p.id);
  if (attIds.length) {
    const { data: bestAtt } = await db.from("fantasy_points").select("player_id, points").in("player_id", attIds).eq("gameweek_id", gameweekId).order("points", { ascending: false }).limit(1);
    if (bestAtt && bestAtt.length > 0) {
      awards.push({ award_type: "highest_attack", player_id: bestAtt[0].player_id, value_points: bestAtt[0].points });
    }
  }

  for (const award of awards) {
    await db.from("weekly_awards").upsert(
      { gameweek_id: gameweekId, ...award },
      { onConflict: "gameweek_id,award_type" }
    );
  }
}
