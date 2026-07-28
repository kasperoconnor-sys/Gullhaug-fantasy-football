-- Run after schema.sql. Seeds the two Gullhaug teams that every squad
-- must include players from. Add your other league opponents the same way.

insert into teams (name, short_name, is_gullhaug) values
  ('Gullhaug Team 1', 'GH1', true),
  ('Gullhaug Team 2', 'GH2', true)
on conflict (name) do nothing;

-- Example opponent teams — replace with your actual league opponents.
insert into teams (name, short_name, is_gullhaug) values
  ('Sandefjord Ung', 'SAN', false),
  ('Holmestrand IF', 'HIF', false),
  ('Tønsberg TIL', 'TON', false),
  ('Larvik Turn', 'LAR', false),
  ('Re FK', 'RE', false),
  ('Horten BK', 'HBK', false)
on conflict (name) do nothing;

-- To make your own account an admin after signing up through the app:
--   update profiles set is_admin = true where id = '<your-auth-user-uuid>';
-- Find your user id in Supabase Dashboard -> Authentication -> Users.
