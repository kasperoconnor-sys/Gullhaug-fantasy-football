-- =====================================================================
-- Gullhaug Fantasy Football — Feature Expansion Migration
-- Run this in the Supabase SQL editor (fresh page, paste, run).
-- Adds: seasons, Hall of Fame archive, Achievements, Weekly Awards.
-- =====================================================================

-- ---------------------------------------------------------------------
-- SEASONS (lets the app track history across multiple years)
-- ---------------------------------------------------------------------
create table if not exists seasons (
  id uuid primary key default gen_random_uuid(),
  label text not null unique, -- e.g. '2026'
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  is_current boolean not null default true
);

-- Ensure exactly one current season, and backfill one for existing data.
insert into seasons (label, is_current)
select '2026', true
where not exists (select 1 from seasons);

alter table gameweeks add column if not exists season_id uuid references seasons (id);
update gameweeks set season_id = (select id from seasons where is_current limit 1) where season_id is null;

-- ---------------------------------------------------------------------
-- HALL OF FAME (archived once a season is marked complete)
-- ---------------------------------------------------------------------
create table if not exists hall_of_fame (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null unique references seasons (id) on delete cascade,
  champion_team_id uuid references fantasy_teams (id),
  runner_up_team_id uuid references fantasy_teams (id),
  third_place_team_id uuid references fantasy_teams (id),
  highest_total_points int,
  highest_gameweek_score int,
  highest_gameweek_team_id uuid references fantasy_teams (id),
  highest_gameweek_number int,
  best_captain_score int,
  best_captain_player_id uuid references players (id),
  most_goals_player_id uuid references players (id),
  most_goals_count int,
  most_clean_sheets_player_id uuid references players (id),
  most_clean_sheets_count int,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- ACHIEVEMENTS (static catalog + per-manager unlocks)
-- ---------------------------------------------------------------------
create table if not exists achievements (
  id text primary key, -- slug e.g. 'hat_trick_hero'
  name text not null,
  description text not null,
  icon text not null default '🏆'
);

insert into achievements (id, name, description, icon) values
  ('hat_trick_hero', 'Hat Trick Hero', 'Own a player who scores a hat-trick.', '🏆'),
  ('goal_machine', 'Goal Machine', 'Score 50 goals with your fantasy squad.', '⚽'),
  ('wall', 'Wall', 'Keep 10 clean sheets.', '🧤'),
  ('differential_king', 'Differential King', 'Earn 5 Scouting Bonuses.', '💎'),
  ('five_green_arrows', 'Five Green Arrows', 'Improve your rank for five consecutive Gameweeks.', '🔥'),
  ('century_club', 'Century Club', 'Score 100+ points in one Gameweek.', '💯'),
  ('captain_fantastic', 'Captain Fantastic', 'Captain scores 20+ points.', '👑'),
  ('first_victory', 'First Victory', 'Win your first Gameweek.', '🏅'),
  ('fast_starter', 'Fast Starter', 'Finish Top 3 after Gameweek 1.', '🚀'),
  ('perfect_transfer', 'Perfect Transfer', 'A transferred-in player scores 15+ points.', '🎯'),
  ('fortress', 'Fortress', 'Score 30+ defensive points in one Gameweek.', '🛡')
on conflict (id) do nothing;

create table if not exists manager_achievements (
  id uuid primary key default gen_random_uuid(),
  fantasy_team_id uuid not null references fantasy_teams (id) on delete cascade,
  achievement_id text not null references achievements (id),
  unlocked_at timestamptz not null default now(),
  gameweek_id uuid references gameweeks (id),
  unique (fantasy_team_id, achievement_id)
);

-- ---------------------------------------------------------------------
-- WEEKLY AWARDS
-- ---------------------------------------------------------------------
create table if not exists weekly_awards (
  id uuid primary key default gen_random_uuid(),
  gameweek_id uuid not null references gameweeks (id) on delete cascade,
  award_type text not null check (award_type in (
    'manager_of_the_week', 'unluckiest_manager', 'captain_of_the_week',
    'best_differential', 'best_defence', 'highest_attack'
  )),
  fantasy_team_id uuid references fantasy_teams (id),
  player_id uuid references players (id),
  value_points int not null default 0,
  created_at timestamptz not null default now(),
  unique (gameweek_id, award_type)
);

-- ---------------------------------------------------------------------
-- ROW LEVEL SECURITY — all new tables are public read, admin write
-- ---------------------------------------------------------------------
alter table seasons enable row level security;
alter table hall_of_fame enable row level security;
alter table achievements enable row level security;
alter table manager_achievements enable row level security;
alter table weekly_awards enable row level security;

create policy "public read seasons" on seasons for select using (true);
create policy "public read hall_of_fame" on hall_of_fame for select using (true);
create policy "public read achievements" on achievements for select using (true);
create policy "public read manager_achievements" on manager_achievements for select using (true);
create policy "public read weekly_awards" on weekly_awards for select using (true);

create policy "admin write seasons" on seasons for all using (is_admin()) with check (is_admin());
create policy "admin write hall_of_fame" on hall_of_fame for all using (is_admin()) with check (is_admin());
create policy "admin write achievements" on achievements for all using (is_admin()) with check (is_admin());
create policy "admin write weekly_awards" on weekly_awards for all using (is_admin()) with check (is_admin());

-- manager_achievements are written by the server (service role) during
-- scoring recalculation, so only admins get a direct write policy here.
create policy "admin write manager_achievements" on manager_achievements for all using (is_admin()) with check (is_admin());
