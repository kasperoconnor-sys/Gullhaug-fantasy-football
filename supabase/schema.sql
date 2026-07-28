-- =====================================================================
-- Gullhaug Fantasy Football (GFF) — Database Schema
-- Run this in the Supabase SQL editor on a fresh project.
-- =====================================================================

-- ---------------------------------------------------------------------
-- EXTENSIONS
-- ---------------------------------------------------------------------
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- ENUM TYPES
-- ---------------------------------------------------------------------
create type player_position as enum ('GK', 'DEF', 'MID', 'FWD');
create type chip_type as enum ('wildcard', 'goal_rush', 'super_defence', 'away_advantage');
create type gameweek_status as enum ('upcoming', 'open', 'in_progress', 'locked', 'completed');

-- ---------------------------------------------------------------------
-- PROFILES (extends Supabase auth.users)
-- ---------------------------------------------------------------------
create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- REAL-LIFE TEAMS
-- ---------------------------------------------------------------------
create table teams (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  short_name text not null,
  is_gullhaug boolean not null default false, -- true for Gullhaug Team 1 & 2
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- SEASON CONFIG (single row, holds the configurable budget etc.)
-- ---------------------------------------------------------------------
create table season_settings (
  id int primary key default 1,
  season_label text not null default '2026',
  starting_budget numeric(6,1) not null default 100.0,
  max_players_per_team int not null default 4,
  min_gullhaug_1 int not null default 2,
  min_gullhaug_2 int not null default 2,
  free_transfers_per_gw int not null default 1,
  max_saved_transfers int not null default 3,
  extra_transfer_cost int not null default 3,
  constraint single_row check (id = 1)
);
insert into season_settings (id) values (1) on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- GAMEWEEKS
-- ---------------------------------------------------------------------
create table gameweeks (
  id uuid primary key default gen_random_uuid(),
  number int not null unique,
  deadline_at timestamptz not null,
  status gameweek_status not null default 'upcoming',
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- FIXTURES
-- ---------------------------------------------------------------------
create table fixtures (
  id uuid primary key default gen_random_uuid(),
  gameweek_id uuid not null references gameweeks (id) on delete cascade,
  home_team_id uuid not null references teams (id),
  away_team_id uuid not null references teams (id),
  kickoff_at timestamptz not null,
  home_fdr smallint not null check (home_fdr between 1 and 5), -- difficulty of this fixture FOR the home team
  away_fdr smallint not null check (away_fdr between 1 and 5),
  home_score int,
  away_score int,
  is_final boolean not null default false,
  min_fotball_ref text, -- optional external reference / URL for traceability
  created_at timestamptz not null default now(),
  check (home_team_id <> away_team_id)
);
create index idx_fixtures_gameweek on fixtures (gameweek_id);

-- ---------------------------------------------------------------------
-- PLAYERS (real-life youth players available in the fantasy pool)
-- ---------------------------------------------------------------------
create table players (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  team_id uuid not null references teams (id),
  position player_position not null,
  price numeric(4,1) not null check (price > 0),
  is_active boolean not null default true, -- false = retired/left club, hidden from new picks
  created_at timestamptz not null default now()
);
create index idx_players_team on players (team_id);
create index idx_players_position on players (position);

-- ---------------------------------------------------------------------
-- PLAYER MATCH STATS (raw per-fixture stats — the source of truth
-- that the scoring engine reads from)
-- ---------------------------------------------------------------------
create table player_match_stats (
  id uuid primary key default gen_random_uuid(),
  fixture_id uuid not null references fixtures (id) on delete cascade,
  player_id uuid not null references players (id) on delete cascade,
  minutes_played int not null default 0,
  goals int not null default 0,
  assists int not null default 0, -- only ever populated for Gullhaug 1 / Gullhaug 2 players
  goals_conceded int not null default 0, -- team's goals conceded while this player was on the pitch
  clean_sheet boolean not null default false,
  yellow_cards int not null default 0,
  red_cards int not null default 0,
  own_goals int not null default 0,
  entered_by uuid references profiles (id), -- admin who entered this row
  updated_at timestamptz not null default now(),
  unique (fixture_id, player_id)
);
create index idx_pms_player on player_match_stats (player_id);

-- ---------------------------------------------------------------------
-- FANTASY TEAMS (one per manager, persists across the whole season)
-- ---------------------------------------------------------------------
create table fantasy_teams (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references profiles (id) on delete cascade,
  team_name text not null,
  budget_remaining numeric(6,1) not null,
  free_transfers int not null default 1,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- FANTASY SQUADS (the 15 owned players — stable roster, price-locked)
-- ---------------------------------------------------------------------
create table fantasy_squad_players (
  id uuid primary key default gen_random_uuid(),
  fantasy_team_id uuid not null references fantasy_teams (id) on delete cascade,
  player_id uuid not null references players (id),
  purchase_price numeric(4,1) not null, -- locked at time of purchase; prices never change mid-season
  added_at timestamptz not null default now(),
  unique (fantasy_team_id, player_id)
);
create index idx_fsp_team on fantasy_squad_players (fantasy_team_id);

-- ---------------------------------------------------------------------
-- GAMEWEEK LINEUPS (starting XI / bench / captain / formation per GW)
-- Rolling captain & rolling substitutions mean this can be updated
-- multiple times during a live gameweek — we keep full history via
-- lineup_events below, and this table always reflects current state.
-- ---------------------------------------------------------------------
create table gameweek_lineups (
  id uuid primary key default gen_random_uuid(),
  fantasy_team_id uuid not null references fantasy_teams (id) on delete cascade,
  gameweek_id uuid not null references gameweeks (id) on delete cascade,
  formation text not null, -- e.g. '4-4-2'
  captain_player_id uuid references players (id),
  vice_captain_player_id uuid references players (id),
  active_chip chip_type,
  updated_at timestamptz not null default now(),
  unique (fantasy_team_id, gameweek_id)
);

create table gameweek_lineup_slots (
  id uuid primary key default gen_random_uuid(),
  lineup_id uuid not null references gameweek_lineups (id) on delete cascade,
  player_id uuid not null references players (id),
  is_starter boolean not null default true,
  bench_order smallint, -- 1-4, null if starter
  unique (lineup_id, player_id)
);
create index idx_gls_lineup on gameweek_lineup_slots (lineup_id);

-- Audit trail for rolling captain changes and rolling substitutions,
-- so we can prove a change was legal (player hadn't started yet).
create table lineup_events (
  id uuid primary key default gen_random_uuid(),
  lineup_id uuid not null references gameweek_lineups (id) on delete cascade,
  event_type text not null check (event_type in ('captain_change', 'substitution')),
  player_out_id uuid references players (id),
  player_in_id uuid references players (id),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- TRANSFERS
-- ---------------------------------------------------------------------
create table transfers (
  id uuid primary key default gen_random_uuid(),
  fantasy_team_id uuid not null references fantasy_teams (id) on delete cascade,
  gameweek_id uuid not null references gameweeks (id),
  player_out_id uuid not null references players (id),
  player_in_id uuid not null references players (id),
  was_free boolean not null default true,
  point_cost int not null default 0, -- 3 per paid transfer
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- CHIPS (one use per chip per season per manager)
-- ---------------------------------------------------------------------
create table chip_usages (
  id uuid primary key default gen_random_uuid(),
  fantasy_team_id uuid not null references fantasy_teams (id) on delete cascade,
  chip chip_type not null,
  gameweek_id uuid not null references gameweeks (id),
  used_at timestamptz not null default now(),
  unique (fantasy_team_id, chip) -- each chip usable once per season
);

-- ---------------------------------------------------------------------
-- FANTASY POINTS (computed, cached results per player per gameweek —
-- rebuilt by the scoring engine whenever stats/admin entries change)
-- ---------------------------------------------------------------------
create table fantasy_points (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references players (id) on delete cascade,
  gameweek_id uuid not null references gameweeks (id) on delete cascade,
  points int not null default 0,
  breakdown jsonb not null default '{}'::jsonb, -- { goals: x, assists: x, clean_sheet: x, ... }
  scouting_bonus_applied boolean not null default false,
  computed_at timestamptz not null default now(),
  unique (player_id, gameweek_id)
);

-- Manager's total score per gameweek (sum of starting XI incl. captain
-- multiplier, chip effects, and transfer point costs)
create table fantasy_team_gameweek_scores (
  id uuid primary key default gen_random_uuid(),
  fantasy_team_id uuid not null references fantasy_teams (id) on delete cascade,
  gameweek_id uuid not null references gameweeks (id) on delete cascade,
  points int not null default 0,
  transfer_cost int not null default 0,
  net_points int not null default 0,
  computed_at timestamptz not null default now(),
  unique (fantasy_team_id, gameweek_id)
);

-- ---------------------------------------------------------------------
-- FANTASY LEAGUES (private leagues with invite codes)
-- ---------------------------------------------------------------------
create table fantasy_leagues (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text not null unique,
  created_by uuid not null references profiles (id),
  is_head_to_head boolean not null default false,
  created_at timestamptz not null default now()
);

create table league_members (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references fantasy_leagues (id) on delete cascade,
  fantasy_team_id uuid not null references fantasy_teams (id) on delete cascade,
  joined_at timestamptz not null default now(),
  unique (league_id, fantasy_team_id)
);

-- ---------------------------------------------------------------------
-- TEAM OF THE WEEK (archived per gameweek)
-- ---------------------------------------------------------------------
create table team_of_the_week (
  id uuid primary key default gen_random_uuid(),
  gameweek_id uuid not null unique references gameweeks (id) on delete cascade,
  formation text not null,
  total_points int not null,
  created_at timestamptz not null default now()
);

create table team_of_the_week_players (
  id uuid primary key default gen_random_uuid(),
  totw_id uuid not null references team_of_the_week (id) on delete cascade,
  player_id uuid not null references players (id),
  points int not null,
  is_captain boolean not null default false
);

-- =====================================================================
-- ROW LEVEL SECURITY
-- =====================================================================
alter table profiles enable row level security;
alter table teams enable row level security;
alter table season_settings enable row level security;
alter table gameweeks enable row level security;
alter table fixtures enable row level security;
alter table players enable row level security;
alter table player_match_stats enable row level security;
alter table fantasy_teams enable row level security;
alter table fantasy_squad_players enable row level security;
alter table gameweek_lineups enable row level security;
alter table gameweek_lineup_slots enable row level security;
alter table lineup_events enable row level security;
alter table transfers enable row level security;
alter table chip_usages enable row level security;
alter table fantasy_points enable row level security;
alter table fantasy_team_gameweek_scores enable row level security;
alter table fantasy_leagues enable row level security;
alter table league_members enable row level security;
alter table team_of_the_week enable row level security;
alter table team_of_the_week_players enable row level security;

-- Helper: is the current user an admin?
create or replace function is_admin() returns boolean as $$
  select coalesce((select is_admin from profiles where id = auth.uid()), false);
$$ language sql stable security definer;

-- Public read-only reference data: everyone (incl. anonymous) can read.
create policy "public read teams" on teams for select using (true);
create policy "public read season_settings" on season_settings for select using (true);
create policy "public read gameweeks" on gameweeks for select using (true);
create policy "public read fixtures" on fixtures for select using (true);
create policy "public read players" on players for select using (true);
create policy "public read player_match_stats" on player_match_stats for select using (true);
create policy "public read fantasy_points" on fantasy_points for select using (true);
create policy "public read team_of_the_week" on team_of_the_week for select using (true);
create policy "public read team_of_the_week_players" on team_of_the_week_players for select using (true);
create policy "public read fantasy_team_gameweek_scores" on fantasy_team_gameweek_scores for select using (true);

-- Only admins can write reference/admin-managed data.
create policy "admin write teams" on teams for all using (is_admin()) with check (is_admin());
create policy "admin write season_settings" on season_settings for all using (is_admin()) with check (is_admin());
create policy "admin write gameweeks" on gameweeks for all using (is_admin()) with check (is_admin());
create policy "admin write fixtures" on fixtures for all using (is_admin()) with check (is_admin());
create policy "admin write players" on players for all using (is_admin()) with check (is_admin());
create policy "admin write player_match_stats" on player_match_stats for all using (is_admin()) with check (is_admin());
create policy "admin write fantasy_points" on fantasy_points for all using (is_admin()) with check (is_admin());
create policy "admin write totw" on team_of_the_week for all using (is_admin()) with check (is_admin());
create policy "admin write totw_players" on team_of_the_week_players for all using (is_admin()) with check (is_admin());
create policy "admin write team scores" on fantasy_team_gameweek_scores for all using (is_admin()) with check (is_admin());

-- Profiles: users read/update their own; admins read all.
create policy "own profile read" on profiles for select using (auth.uid() = id or is_admin());
create policy "own profile update" on profiles for update using (auth.uid() = id);
create policy "own profile insert" on profiles for insert with check (auth.uid() = id);

-- Fantasy teams: manager owns their own; everyone can read (for leaderboards).
create policy "read all fantasy_teams" on fantasy_teams for select using (true);
create policy "manage own fantasy_team" on fantasy_teams for insert with check (auth.uid() = user_id);
create policy "update own fantasy_team" on fantasy_teams for update using (auth.uid() = user_id);

-- Squad players: owner manages their own squad; public can read (for "most selected" stats).
create policy "read all squads" on fantasy_squad_players for select using (true);
create policy "manage own squad" on fantasy_squad_players for all
  using (exists (select 1 from fantasy_teams ft where ft.id = fantasy_team_id and ft.user_id = auth.uid()))
  with check (exists (select 1 from fantasy_teams ft where ft.id = fantasy_team_id and ft.user_id = auth.uid()));

-- Lineups: owner manages their own; public read for transparency after lock.
create policy "read all lineups" on gameweek_lineups for select using (true);
create policy "manage own lineup" on gameweek_lineups for all
  using (exists (select 1 from fantasy_teams ft where ft.id = fantasy_team_id and ft.user_id = auth.uid()))
  with check (exists (select 1 from fantasy_teams ft where ft.id = fantasy_team_id and ft.user_id = auth.uid()));

create policy "read all lineup slots" on gameweek_lineup_slots for select using (true);
create policy "manage own lineup slots" on gameweek_lineup_slots for all
  using (exists (
    select 1 from gameweek_lineups gl join fantasy_teams ft on ft.id = gl.fantasy_team_id
    where gl.id = lineup_id and ft.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from gameweek_lineups gl join fantasy_teams ft on ft.id = gl.fantasy_team_id
    where gl.id = lineup_id and ft.user_id = auth.uid()
  ));

create policy "read all lineup events" on lineup_events for select using (true);
create policy "manage own lineup events" on lineup_events for insert
  with check (exists (
    select 1 from gameweek_lineups gl join fantasy_teams ft on ft.id = gl.fantasy_team_id
    where gl.id = lineup_id and ft.user_id = auth.uid()
  ));

-- Transfers & chips: owner manages their own; public read for stats.
create policy "read all transfers" on transfers for select using (true);
create policy "manage own transfers" on transfers for insert
  with check (exists (select 1 from fantasy_teams ft where ft.id = fantasy_team_id and ft.user_id = auth.uid()));

create policy "read all chip_usages" on chip_usages for select using (true);
create policy "manage own chips" on chip_usages for insert
  with check (exists (select 1 from fantasy_teams ft where ft.id = fantasy_team_id and ft.user_id = auth.uid()));

-- Leagues: anyone can read; creator/admin manages; joining handled via API route
-- (service role) so invite-code lookups don't require exposing all leagues.
create policy "read all leagues" on fantasy_leagues for select using (true);
create policy "create own league" on fantasy_leagues for insert with check (auth.uid() = created_by);
create policy "update own league" on fantasy_leagues for update using (auth.uid() = created_by or is_admin());

create policy "read all league_members" on league_members for select using (true);
create policy "join league as self" on league_members for insert
  with check (exists (select 1 from fantasy_teams ft where ft.id = fantasy_team_id and ft.user_id = auth.uid()));
