import { createClient, createServiceClient } from "@/lib/supabase/server";
import { applyCaptainMultiplier, calculatePlayerPoints } from "@/lib/scoring";
import { NextResponse } from "next/server";

/**
 * Recalculates fantasy_points for every player with stats in the given
 * gameweek, then recomputes each fantasy team's gameweek score
 * (starting XI + captain multiplier + auto-subs + transfer costs).
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
  if (!profile?.is_admin) return NextResponse.json({ error: "Kun admin kan gjøre dette." }, { status: 403 });

  const { gameweek_id } = (await request.json()) as { gameweek_id: string };
  const db = createServiceClient();

  const { data: totalTeamsRows } = await db.from("fantasy_teams").select("id");
  const managerCount = totalTeamsRows?.length ?? 1;

  const { data: fixtures } = await db.from("fixtures").select("*").eq("gameweek_id", gameweek_id);
  const fixtureIds = (fixtures ?? []).map((f: any) => f.id);
  const teamById = new Map<string, any>();
  (await db.from("teams").select("*")).data?.forEach((t: any) => teamById.set(t.id, t));

  const { data: statsRows } = fixtureIds.length
    ? await db.from("player_match_stats").select("*").in("fixture_id", fixtureIds)
    : { data: [] as any[] };

  const { data: chipLineups } = await db
    .from("gameweek_lineups")
    .select("fantasy_team_id, active_chip")
    .eq("gameweek_id", gameweek_id)
    .not("active_chip", "is", null);
  const chipByTeam = new Map<string, string>();
  (chipLineups ?? []).forEach((l: any) => chipByTeam.set(l.fantasy_team_id, l.active_chip));

  // Ownership: how many fantasy squads currently own each player.
  const { data: squadRows } = await db.from("fantasy_squad_players").select("player_id, fantasy_team_id");
  const ownershipCount = new Map<string, number>();
  (squadRows ?? []).forEach((r: any) => ownershipCount.set(r.player_id, (ownershipCount.get(r.player_id) ?? 0) + 1));

  for (const stat of statsRows ?? []) {
    const { data: player } = await db.from("players").select("*, team:teams(*)").eq("id", stat.player_id).single();
    if (!player) continue;

    const fixture = (fixtures ?? []).find((f: any) => f.id === stat.fixture_id);
    const isAway = fixture?.away_team_id === player.team_id;
    const teamWon = fixture?.is_final
      ? isAway
        ? fixture.away_score > fixture.home_score
        : fixture.home_score > fixture.away_score
      : false;

    const ownershipPct = ((ownershipCount.get(player.id) ?? 0) / managerCount) * 100;

    const breakdown = calculatePlayerPoints(player, stat, {
      isGullhaugPlayer: player.team?.is_gullhaug ?? false,
      ownershipPct,
      isAwayFixture: isAway,
      teamWon,
      // Chip effects are per fantasy-team, applied at aggregation stage below
      // when computing each manager's total; base fantasy_points stay chip-free
      // so the same player row is reusable across every manager who owns them.
    });

    await db.from("fantasy_points").upsert(
      {
        player_id: player.id,
        gameweek_id,
        points: breakdown.total,
        breakdown,
        scouting_bonus_applied: breakdown.scouting_bonus > 0,
        computed_at: new Date().toISOString(),
      },
      { onConflict: "player_id,gameweek_id" }
    );
  }

  // Aggregate each manager's gameweek score from their locked lineup.
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
      const base = fp?.points ?? 0;
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

  return NextResponse.json({ ok: true, players_scored: statsRows?.length ?? 0, teams_scored: lineups?.length ?? 0 });
}

async function hasMinutes(db: any, playerId: string | null, gameweekId: string) {
  if (!playerId) return false;
  const { data } = await db
    .from("player_match_stats")
    .select("minutes_played, fixture:fixtures!inner(gameweek_id)")
    .eq("player_id", playerId)
    .eq("fixture.gameweek_id", gameweekId)
    .maybeSingle();
  return (data?.minutes_played ?? 0) > 0;
}
