export type PlayerPosition = "GK" | "DEF" | "MID" | "FWD";

export type ChipType = "wildcard" | "goal_rush" | "super_defence" | "away_advantage";

export type GameweekStatus = "upcoming" | "open" | "in_progress" | "locked" | "completed";

export interface Team {
  id: string;
  name: string;
  short_name: string;
  is_gullhaug: boolean;
  league?: string | null;
  color?: string | null;
}

export interface Player {
  id: string;
  name: string;
  team_id: string;
  position: PlayerPosition;
  price: number;
  is_active: boolean;
  // joined fields (optional, populated by queries that select teams(*))
  team?: Team;
  ownership_pct?: number;
}

export interface Fixture {
  id: string;
  gameweek_id: string;
  home_team_id: string;
  away_team_id: string;
  kickoff_at: string;
  home_fdr: number;
  away_fdr: number;
  home_score: number | null;
  away_score: number | null;
  is_final: boolean;
}

export interface Gameweek {
  id: string;
  number: number;
  deadline_at: string;
  status: GameweekStatus;
}

export interface PlayerMatchStats {
  id: string;
  fixture_id: string;
  player_id: string;
  minutes_played: number;
  goals: number;
  assists: number;
  goals_conceded: number;
  clean_sheet: boolean;
  yellow_cards: number;
  red_cards: number;
  own_goals: number;
}

export interface FantasyTeam {
  id: string;
  user_id: string;
  team_name: string;
  budget_remaining: number;
  free_transfers: number;
}

export interface FantasySquadPlayer {
  id: string;
  fantasy_team_id: string;
  player_id: string;
  purchase_price: number;
}

export interface GameweekLineup {
  id: string;
  fantasy_team_id: string;
  gameweek_id: string;
  formation: string;
  captain_player_id: string | null;
  vice_captain_player_id: string | null;
  active_chip: ChipType | null;
}

export interface GameweekLineupSlot {
  id: string;
  lineup_id: string;
  player_id: string;
  is_starter: boolean;
  bench_order: number | null;
}

export interface PointsBreakdown {
  appearance: number;
  goals: number;
  assists: number;
  clean_sheet: number;
  conceded_deduction: number;
  cards: number;
  own_goals: number;
  scouting_bonus: number;
  chip_bonus: number;
  goal_bonus: number;
  total: number;
}

export const FORMATIONS: Record<string, { DEF: number; MID: number; FWD: number }> = {
  "3-4-3": { DEF: 3, MID: 4, FWD: 3 },
  "3-5-2": { DEF: 3, MID: 5, FWD: 2 },
  "4-4-2": { DEF: 4, MID: 4, FWD: 2 },
  "4-3-3": { DEF: 4, MID: 3, FWD: 3 },
  "4-5-1": { DEF: 4, MID: 5, FWD: 1 },
  "5-3-2": { DEF: 5, MID: 3, FWD: 2 },
  "5-4-1": { DEF: 5, MID: 4, FWD: 1 },
};

export const SQUAD_REQUIREMENTS = { GK: 2, DEF: 5, MID: 5, FWD: 3 } as const;
