import { createClient, createServiceClient } from "@/lib/supabase/server";
import { applyCaptainMultiplier, calculatePlayerPoints, computeScoutingBonus } from "@/lib/scoring";
import { evaluateAchievements } from "@/lib/achievements";
import { generateWeeklyAwards } from "@/lib/weeklyAwards";
import { PointsBreakdown } from "@/types";
import { NextResponse } from "next/server";

const emptyBreakdown = (): PointsBreakdown => ({
  appearance: 0,
  goals: 0,
  assists: 0,
  clean_sheet: 0,
  conceded_deduction: 0,
  cards: 0,
  own_goals: 0,
  scouting_bonus: 0,
  chip_bonus: 0,
  goal_bonus: 0,
  total: 0,
});

function addBreakdown(a: PointsBreakdown, b: PointsBreakdown): PointsBreakdown {
  return {
    appearance: a.appearance + b.appearance,
    goals: a.goals + b.goals,
    assists: a.assists + b.assists,
    clean_sheet: a.clean_sheet + b.clean_sheet,
    conceded_deduction: a.conceded_deduction + b.conceded_deduction,
    cards: a.cards + b.cards,
    own_goals: a.own_goals + b.own_goals,
    scouting_bonus: a.scouting_bonus + b.scouting_bonus,
    chip_bonus: a.chip_bonus + b.chip_bonus,
    goal_bonus: a.goal_bonus + b.goal_bonus,
    total: a.total + b.total,
  };
}

/**
 * Recalculates fantasy_points for every player with stats in the given
 * gameweek, then recomputes each fantasy team's gameweek score.
 *
 * Handles Double Gameweeks: if a player has stats from more than one
 * fixture in the same gameweek, each match is scored separately (its
 * own clean sheet / conceded deduction / bonus goals) and then summed
 * into one combined fantasy_points row.
 *
 * Chip effects (Goal Rush, Super Defence, Away Advantage) are applied
 * per-manager at the team-aggregation stage below, NOT baked into the
 * shared per-player fantasy_points row — two managers can own the same
 * player while only one of them has a chip active that gameweek.
 *
 * Call this from the admin dashboard any time match results, cards, or
 * Gullhaug assists are entered/edited.
 */
export async function POST(request: Request) {
  const supabase = createClient();
  const { data: userData } = await supabase.auth.getUser();
  const { data: profile } = userData.user
    ? await supabase.from("profiles").select("is_admin").eq("id", userData.user.id).single()
    : { data: null };
  if (!profile?.is_admin) return NextResponse.json({ error: "Only admins can do this." }, { status: 403 });

  const { gameweek_id } = (await request.json()) as { gameweek_id: string };
  const db = createServiceClient();

  const { data: totalTeamsRows } = await db.from("fantasy_teams").select("id");
  const managerCount = totalTeamsRows?.length || 1;

  const { data: fixtures } = await db.from("fixtures").select("*").eq("gameweek_id", gameweek_id);
  const fixtureIds = (fixtures ?? []).map((f: any) => f.id);

  const { data: statsRows } = fixtureIds.length
    ? await db.from("player_match_stats").select("*").in("fixture_id", fixtureIds)
    : { data: [] as any[] };

  // Ownership: how many fantasy squads currently own each player.
  const { data: squadRows } = await db.from("fantasy_squad_players").select("player_id, fantasy_team_id");
  const ownershipCount = new Map<string, number>();
  (squadRows ?? []).forEach((r: any) => ownershipCount.set(r.player_id, (ownershipCount.get(r.player_id) ?? 0) + 1));

  // Group raw stat rows by player — a player with 2+ rows this gameweek
  // means their team played a Double Gameweek.
  const statsByPlayer = new Map<string, any[]>();
  (statsRows ?? []).forEach((s: any) => {
    const list = statsByPlayer.get(s.player_id) ?? [];
    list.push(s);
    statsByPlayer.set(s.player_id, list);
  });

  const playerCache = new Map<string, any>();
  async function getPlayer(id: string) {
    if (!playerCache.has(id)) {
      const { data } = await db.from("players").select("*, team:teams(*)").eq("id", id).single();
      playerCache.set(id, data);
    }
    return playerCache.get(id);
  }

  // Raw per-player gameweek totals, needed later to apply chip bonuses
  // per-manager (goal_rush needs total goals; super_defence needs "any
  // clean sheet"; away_advantage needs "any away win").
  const rawTotals = new Map<string, { goals: number; anyCleanSheet: boolean; anyAwayWin: boolean; position: string }>();

  for (const [playerId, rows] of statsByPlayer.entries()) {
    const player = await getPlayer(playerId);
    if (!player) continue;

    let combined = emptyBreakdown();
    let goalsSum = 0;
    let anyCleanSheet = false;
    let anyAwayWin = false;

    for (const stat of rows) {
      const fixture = (fixtures ?? []).find((f: any) => f.id === stat.fixture_id);
      const isAway = fixture?.away_team_id === player.team_id;
      const teamWon = fixture?.is_final
        ? isAway
          ? fixture.away_score > fixture.home_score
          : fixture.home_score > fixture.away_score
        : false;

      const ownershipPct = ((ownershipCount.get(player.id) ?? 0) / managerCount) * 100;

      const matchBreakdown = calculatePlayerPoints(player, stat, {
        isGullhaugPlayer: player.team?.is_gullhaug ?? false,
        ownershipPct,
        applyScoutingBonus: false, // applied once below on the combined total
      });

      combined = addBreakdown(combined, matchBreakdown);
      goalsSum += stat.goals;
      if (stat.clean_sheet) anyCleanSheet = true;
      if (isAway && teamWon) anyAwayWin = true;
    }

    const scoutingBonus = computeScoutingBonus(combined.total, ((ownershipCount.get(player.id) ?? 0) / managerCount) * 100);
    combined.scouting_bonus = scoutingBonus;
    combined.total += scoutingBonus;

    rawTotals.set(playerId, { goals: goalsSum, anyCleanSheet, anyAwayWin, position: player.position });

    await db.from("fantasy_points").upsert(
      {
        player_id: playerId,
        gameweek_id,
        points: combined.total,
        breakdown: combined,
        scouting_bonus_applied: scoutingBonus > 0,
        computed_at: new Date().toISOString(),
      },
      { onConflict: "player_id,gameweek_id" }
    );
  }

  // Aggregate each manager's gameweek score from their locked lineup,
  // applying captain multiplier and any per-manager chip bonus.
  const { data: lineups } = await db
    .from("gameweek_lineups")
    .select("*, slots:gameweek_lineup_slots(*)")
    .eq("gameweek_id", gameweek_id);

  const { data: allPoints } = await db.from("fantasy_points").select("*").eq("gameweek_id", gameweek_id);
  const pointsByPlayer = new Map<string, any>((allPoints ?? []).map((p: any) => [p.player_id, p]));

  for (const lineup of lineups ?? []) {
    const starters = lineup.slots.filter((s: any) => s.is_starter);
    const captainStats = pointsByPlayer.get(lineup.captain_player_id);
    const captainPlayed = (captainStats?.points ?? 0) !== 0 || (await hasMinutes(db, lineup.captain_player_id, gameweek_id));

    let total = 0;
    for (const slot of starters) {
      const fp = pointsByPlayer.get(slot.player_id);
      let base = fp?.points ?? 0;

      // Per-manager chip bonus, computed from raw totals (not baked into
      // the shared fantasy_points row above).
      if (lineup.active_chip) {
        const raw = rawTotals.get(slot.player_id);
        if (raw) {
          if (lineup.active_chip === "goal_rush") base += raw.goals * 2;
          if (lineup.active_chip === "super_defence" && raw.anyCleanSheet && (raw.position === "GK" || raw.position === "DEF")) base += 2;
          if (lineup.active_chip === "away_advantage" && raw.anyAwayWin) base += 2;
        }
      }

      const withCaptain = applyCaptainMultiplier(
        slot.player_id,
        base,
        lineup.captain_player_id,
        lineup.vice_captain_player_id,
        captainPlayed
      );
      total += withCaptain;
    }

    const { data: transferRows } = await db
      .from("transfers")
      .select("point_cost")
      .eq("fantasy_team_id", lineup.fantasy_team_id)
      .eq("gameweek_id", gameweek_id);
    const transferCost = (transferRows ?? []).reduce((sum: number, t: any) => sum + t.point_cost, 0);

    await db.from("fantasy_team_gameweek_scores").upsert(
      {
        fantasy_team_id: lineup.fantasy_team_id,
        gameweek_id,
        points: total,
        transfer_cost: transferCost,
        net_points: total - transferCost,
        computed_at: new Date().toISOString(),
      },
      { onConflict: "fantasy_team_id,gameweek_id" }
    );
  }

  // Achievements + Weekly Awards run after every team's score is final.
  for (const lineup of lineups ?? []) {
    await evaluateAchievements(db, lineup.fantasy_team_id, gameweek_id);
  }
  await generateWeeklyAwards(db, gameweek_id);

  return NextResponse.json({ ok: true, players_scored: statsByPlayer.size, teams_scored: lineups?.length ?? 0 });
}

async function hasMinutes(db: any, playerId: string | null, gameweekId: string) {
  if (!playerId) return false;
  const { data } = await db
    .from("player_match_stats")
    .select("minutes_played, fixture:fixtures!inner(gameweek_id)")
    .eq("player_id", playerId)
    .eq("fixture.gameweek_id", gameweekId)
    .limit(1)
    .maybeSingle();
  return (data?.minutes_played ?? 0) > 0;
}
