import { Player, SQUAD_REQUIREMENTS } from "@/types";

export interface SquadValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validates a proposed 15-player squad against every league rule:
 * position quotas, max 4 per real-life team, min 2 from each Gullhaug
 * team, and budget.
 */
export function validateSquad(
  players: Player[],
  budgetCap: number,
  opts: { maxPerTeam?: number; minGullhaug1?: number; minGullhaug2?: number; gullhaug1Id: string; gullhaug2Id: string }
): SquadValidationResult {
  const errors: string[] = [];
  const maxPerTeam = opts.maxPerTeam ?? 4;
  const minG1 = opts.minGullhaug1 ?? 2;
  const minG2 = opts.minGullhaug2 ?? 2;

  if (players.length !== 15) {
    errors.push(`Squad must have exactly 15 players (currently ${players.length}).`);
  }

  (["GK", "DEF", "MID", "FWD"] as const).forEach((pos) => {
    const count = players.filter((p) => p.position === pos).length;
    if (count !== SQUAD_REQUIREMENTS[pos]) {
      errors.push(`Need exactly ${SQUAD_REQUIREMENTS[pos]} ${pos}, currently ${count}.`);
    }
  });

  const teamCounts = new Map<string, number>();
  players.forEach((p) => teamCounts.set(p.team_id, (teamCounts.get(p.team_id) ?? 0) + 1));
  teamCounts.forEach((count, teamId) => {
    if (count > maxPerTeam) {
      errors.push(`Too many players (${count}) from the same team (max ${maxPerTeam}).`);
    }
  });

  const g1Count = teamCounts.get(opts.gullhaug1Id) ?? 0;
  const g2Count = teamCounts.get(opts.gullhaug2Id) ?? 0;
  if (g1Count < minG1) errors.push(`Need at least ${minG1} players from Gullhaug 1 (currently ${g1Count}).`);
  if (g2Count < minG2) errors.push(`Need at least ${minG2} players from Gullhaug 2 (currently ${g2Count}).`);

  const totalCost = players.reduce((sum, p) => sum + p.price, 0);
  if (totalCost > budgetCap) {
    errors.push(`Squad costs ${totalCost.toFixed(1)}M, over the ${budgetCap.toFixed(1)}M budget.`);
  }

  return { valid: errors.length === 0, errors };
}
