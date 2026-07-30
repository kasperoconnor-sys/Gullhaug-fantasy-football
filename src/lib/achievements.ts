/**
 * Evaluates every achievement rule for one fantasy team after a
 * gameweek's scoring has been recalculated, and unlocks any newly
 * earned ones. Achievements are permanent — this only ever inserts,
 * never removes.
 */
export async function evaluateAchievements(db: any, fantasyTeamId: string, gameweekId: string) {
  const { data: alreadyUnlocked } = await db
    .from("manager_achievements")
    .select("achievement_id")
    .eq("fantasy_team_id", fantasyTeamId);
  const unlocked = new Set((alreadyUnlocked ?? []).map((a: any) => a.achievement_id));

  const toUnlock: string[] = [];

  const { data: squadRows } = await db.from("fantasy_squad_players").select("player_id").eq("fantasy_team_id", fantasyTeamId);
  const squadPlayerIds: string[] = (squadRows ?? []).map((r: any) => r.player_id);

  // hat_trick_hero — any squad player ever scored 3+ in a single match.
  if (!unlocked.has("hat_trick_hero") && squadPlayerIds.length) {
    const { data } = await db.from("player_match_stats").select("id").in("player_id", squadPlayerIds).gte("goals", 3).limit(1);
    if (data && data.length > 0) toUnlock.push("hat_trick_hero");
  }

  // goal_machine — squad players' combined lifetime goals >= 50.
  if (!unlocked.has("goal_machine") && squadPlayerIds.length) {
    const { data } = await db.from("player_match_stats").select("goals").in("player_id", squadPlayerIds);
    const totalGoals = (data ?? []).reduce((s: number, r: any) => s + r.goals, 0);
    if (totalGoals >= 50) toUnlock.push("goal_machine");
  }

  // wall — 10+ clean sheets across everything the squad has ever recorded.
  if (!unlocked.has("wall") && squadPlayerIds.length) {
    const { data } = await db.from("player_match_stats").select("id").in("player_id", squadPlayerIds).eq("clean_sheet", true);
    if ((data ?? []).length >= 10) toUnlock.push("wall");
  }

  // differential_king — 5+ gameweeks with a scouting bonus among current squad.
  if (!unlocked.has("differential_king") && squadPlayerIds.length) {
    const { data } = await db
      .from("fantasy_points")
      .select("id")
      .in("player_id", squadPlayerIds)
      .eq("scouting_bonus_applied", true);
    if ((data ?? []).length >= 5) toUnlock.push("differential_king");
  }

  // century_club — 100+ net points in this gameweek.
  const { data: thisWeekScore } = await db
    .from("fantasy_team_gameweek_scores")
    .select("net_points")
    .eq("fantasy_team_id", fantasyTeamId)
    .eq("gameweek_id", gameweekId)
    .maybeSingle();
  if (!unlocked.has("century_club") && (thisWeekScore?.net_points ?? 0) >= 100) toUnlock.push("century_club");

  // captain_fantastic — captain scored 20+ base points this gameweek.
  const { data: lineup } = await db
    .from("gameweek_lineups")
    .select("captain_player_id")
    .eq("fantasy_team_id", fantasyTeamId)
    .eq("gameweek_id", gameweekId)
    .maybeSingle();
  if (!unlocked.has("captain_fantastic") && lineup?.captain_player_id) {
    const { data: capPoints } = await db
      .from("fantasy_points")
      .select("points")
      .eq("player_id", lineup.captain_player_id)
      .eq("gameweek_id", gameweekId)
      .maybeSingle();
    if ((capPoints?.points ?? 0) >= 20) toUnlock.push("captain_fantastic");
  }

  // fortress — 30+ combined points from GK+DEF starters this gameweek.
  if (!unlocked.has("fortress")) {
    const { data: lineupFull } = await db
      .from("gameweek_lineups")
      .select("id, slots:gameweek_lineup_slots(player_id, is_starter)")
      .eq("fantasy_team_id", fantasyTeamId)
      .eq("gameweek_id", gameweekId)
      .maybeSingle();
    if (lineupFull) {
      const starterIds = (lineupFull.slots ?? []).filter((s: any) => s.is_starter).map((s: any) => s.player_id);
      if (starterIds.length) {
        const { data: defPlayers } = await db.from("players").select("id, position").in("id", starterIds).in("position", ["GK", "DEF"]);
        const defIds = (defPlayers ?? []).map((p: any) => p.id);
        if (defIds.length) {
          const { data: defPoints } = await db.from("fantasy_points").select("points").in("player_id", defIds).eq("gameweek_id", gameweekId);
          const defTotal = (defPoints ?? []).reduce((s: number, r: any) => s + r.points, 0);
          if (defTotal >= 30) toUnlock.push("fortress");
        }
      }
    }
  }

  // first_victory / fast_starter — need every team's score this gameweek to find rank.
  const { data: allScores } = await db.from("fantasy_team_gameweek_scores").select("fantasy_team_id, net_points").eq("gameweek_id", gameweekId);
  if (allScores && allScores.length > 0) {
    const sorted = [...allScores].sort((a: any, b: any) => b.net_points - a.net_points);
    const myRank = sorted.findIndex((s: any) => s.fantasy_team_id === fantasyTeamId) + 1;

    if (!unlocked.has("first_victory") && myRank === 1) toUnlock.push("first_victory");

    const { data: gw } = await db.from("gameweeks").select("number").eq("id", gameweekId).single();
    if (!unlocked.has("fast_starter") && gw?.number === 1 && myRank > 0 && myRank <= 3) toUnlock.push("fast_starter");
  }

  // perfect_transfer — a player transferred in this gameweek scored 15+.
  if (!unlocked.has("perfect_transfer")) {
    const { data: transfersIn } = await db
      .from("transfers")
      .select("player_in_id")
      .eq("fantasy_team_id", fantasyTeamId)
      .eq("gameweek_id", gameweekId);
    const inIds = (transfersIn ?? []).map((t: any) => t.player_in_id);
    if (inIds.length) {
      const { data: inPoints } = await db.from("fantasy_points").select("points").in("player_id", inIds).eq("gameweek_id", gameweekId);
      if ((inPoints ?? []).some((p: any) => p.points >= 15)) toUnlock.push("perfect_transfer");
    }
  }

  // five_green_arrows — rank improved for 5 consecutive gameweeks up to and including this one.
  if (!unlocked.has("five_green_arrows")) {
    const { data: gws } = await db.from("gameweeks").select("id, number").lte("number", (await db.from("gameweeks").select("number").eq("id", gameweekId).single()).data?.number ?? 0).order("number", { ascending: true });
    const recentGws = (gws ?? []).slice(-6); // need 5 transitions -> 6 datapoints
    if (recentGws.length >= 6) {
      const ranks: number[] = [];
      for (const g of recentGws) {
        const { data: scoresForGw } = await db.from("fantasy_team_gameweek_scores").select("fantasy_team_id, net_points").eq("gameweek_id", g.id);
        if (!scoresForGw || scoresForGw.length === 0) {
          ranks.push(Infinity);
          continue;
        }
        const cumulative = new Map<string, number>();
        scoresForGw.forEach((s: any) => cumulative.set(s.fantasy_team_id, (cumulative.get(s.fantasy_team_id) ?? 0) + s.net_points));
        const sortedGw = [...cumulative.entries()].sort((a, b) => b[1] - a[1]);
        const rank = sortedGw.findIndex(([id]) => id === fantasyTeamId) + 1;
        ranks.push(rank > 0 ? rank : Infinity);
      }
      let improvingStreak = 0;
      for (let i = 1; i < ranks.length; i++) {
        if (ranks[i] < ranks[i - 1]) improvingStreak++;
        else improvingStreak = 0;
      }
      if (improvingStreak >= 5) toUnlock.push("five_green_arrows");
    }
  }

  if (toUnlock.length > 0) {
    await db.from("manager_achievements").insert(
      toUnlock.map((achievement_id) => ({ fantasy_team_id: fantasyTeamId, achievement_id, gameweek_id: gameweekId }))
    );
  }

  return toUnlock;
}
