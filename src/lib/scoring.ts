import { ChipType, Player, PlayerMatchStats, PointsBreakdown } from "@/types";

/**
 * Goals-conceded deduction table (shared by GK and DEF):
 *   0 -> 0   1 -> 0   2 -> 1   3 -> 1   4 -> 2   5 -> 2   6 -> 2   7 -> 3
 * Rule: -1 per 2 goals conceded, then after 4 conceded, -1 per additional 3.
 */
export function concededDeduction(conceded: number): number {
  if (conceded <= 0) return 0;
  if (conceded <= 4) return Math.floor(conceded / 2);
  return 2 + Math.floor((conceded - 4) / 3);
}

const GOAL_POINTS: Record<Player["position"], number> = {
  GK: 20,
  DEF: 8,
  MID: 6,
  FWD: 5,
};

const ASSIST_POINTS: Record<Player["position"], number> = {
  GK: 5,
  DEF: 5,
  MID: 3,
  FWD: 3,
};

const CLEAN_SHEET_POINTS: Record<Player["position"], number> = {
  GK: 5,
  DEF: 4,
  MID: 1,
  FWD: 0,
};

export interface ScoringContext {
  isGullhaugPlayer: boolean; // assists only ever count for Gullhaug 1 / Gullhaug 2
  ownershipPct: number; // % of managers who own this player, for the scouting bonus
  activeChip?: ChipType | null;
  isAwayFixture?: boolean;
  teamWon?: boolean;
}

/**
 * Computes a single player's fantasy points for one gameweek from their
 * raw match stats. This is the single source of truth for scoring —
 * used both by the recalculation API route and (optionally) any
 * client-side preview.
 */
export function calculatePlayerPoints(
  player: Pick<Player, "position">,
  stats: Pick<
    PlayerMatchStats,
    "minutes_played" | "goals" | "assists" | "goals_conceded" | "clean_sheet" | "yellow_cards" | "red_cards" | "own_goals"
  >,
  ctx: ScoringContext
): PointsBreakdown {
  const pos = player.position;
  const played = stats.minutes_played > 0;

  const appearance = played ? 1 : 0;

  let goalRushBonus = 0;
  const goals = stats.goals * GOAL_POINTS[pos];
  if (ctx.activeChip === "goal_rush" && stats.goals > 0) {
    goalRushBonus = stats.goals * 2;
  }

  // Assists only ever tracked/awarded for Gullhaug 1 / Gullhaug 2 players.
  const assists = ctx.isGullhaugPlayer ? stats.assists * ASSIST_POINTS[pos] : 0;

  let cleanSheet = stats.clean_sheet ? CLEAN_SHEET_POINTS[pos] : 0;
  let superDefenceBonus = 0;
  if (ctx.activeChip === "super_defence" && stats.clean_sheet && (pos === "GK" || pos === "DEF")) {
    superDefenceBonus = 2;
  }

  // Conceded deduction only applies to GK and DEF.
  const concededPenalty = pos === "GK" || pos === "DEF" ? -concededDeduction(stats.goals_conceded) : 0;

  const cards = -(stats.yellow_cards * 1 + stats.red_cards * 3);
  const ownGoals = -(stats.own_goals * 2);

  let awayAdvantageBonus = 0;
  if (ctx.activeChip === "away_advantage" && ctx.isAwayFixture && ctx.teamWon) {
    awayAdvantageBonus = 2;
  }

  const chipBonus = goalRushBonus + superDefenceBonus + awayAdvantageBonus;

  const subtotal = appearance + goals + assists + cleanSheet + concededPenalty + cards + ownGoals + chipBonus;

  // Scouting bonus: <5% ownership AND >=5 points this gameweek (checked
  // against the subtotal, before the bonus itself is added).
  const scoutingBonus = ctx.ownershipPct < 5 && subtotal >= 5 ? 2 : 0;

  const total = subtotal + scoutingBonus;

  return {
    appearance,
    goals,
    assists,
    clean_sheet: cleanSheet + superDefenceBonus,
    conceded_deduction: concededPenalty,
    cards,
    own_goals: ownGoals,
    scouting_bonus: scoutingBonus,
    chip_bonus: goalRushBonus + awayAdvantageBonus,
    total,
  };
}

/**
 * Applies the captain multiplier. If the captain didn't play this
 * gameweek, the vice captain's points are doubled instead.
 */
export function applyCaptainMultiplier(
  playerId: string,
  points: number,
  captainId: string | null,
  viceCaptainId: string | null,
  captainPlayed: boolean
): number {
  if (captainId && playerId === captainId && captainPlayed) return points * 2;
  if (!captainPlayed && viceCaptainId && playerId === viceCaptainId) return points * 2;
  return points;
}

/**
 * Rolling captain validation: the new captain's fixture must not have
 * kicked off yet.
 */
export function canChangeCaptain(candidateKickoffAt: string, now: Date = new Date()): boolean {
  return new Date(candidateKickoffAt).getTime() > now.getTime();
}

/**
 * Rolling substitution validation:
 * - outgoing player: no restriction on their own match state (they may
 *   have already played)
 * - incoming player: their match must not have started yet
 */
export function canMakeSubstitution(incomingKickoffAt: string, now: Date = new Date()): boolean {
  return new Date(incomingKickoffAt).getTime() > now.getTime();
}

/** Validates a formation's starter counts (GK always 1, out of 11 total). */
export function isValidFormationCounts(
  counts: { GK: number; DEF: number; MID: number; FWD: number },
  formation: { DEF: number; MID: number; FWD: number }
): boolean {
  const total = counts.GK + counts.DEF + counts.MID + counts.FWD;
  return (
    total === 11 &&
    counts.GK === 1 &&
    counts.DEF === formation.DEF &&
    counts.MID === formation.MID &&
    counts.FWD === formation.FWD &&
    counts.DEF >= 3 &&
    counts.MID >= 3 &&
    counts.FWD >= 1
  );
}
