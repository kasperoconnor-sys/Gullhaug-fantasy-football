# Gullhaug Fantasy Football (GFF)

Full-stack fantasy football app for Gullhaug — Next.js 14 (App Router) + TypeScript + Tailwind + Supabase (Postgres, Auth, RLS).

## 1. Set up Supabase

1. Create a new project at [supabase.com](https://supabase.com).
2. Open the SQL Editor and run, in order:
   - `supabase/schema.sql` (tables, types, RLS policies)
   - `supabase/seed.sql` (Gullhaug Team 1 & 2, example opponents)
3. Go to Project Settings → API and copy your Project URL, anon key, and service role key.

## 2. Configure the app

```bash
cp .env.local.example .env.local
# then fill in NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
```

## 3. Install and run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000, sign up for an account (this also creates your fantasy team).

## 4. Make yourself an admin

In the Supabase SQL editor:

```sql
update profiles set is_admin = true where id = '<your-auth-user-id>';
```

(Find your user ID under Authentication → Users.) Then visit `/admin`.

## 5. Run a season

1. **`/admin/teams`** — add any opponent teams not already seeded.
2. **`/admin/players`** — add every player (name, team, position, price) before the season starts.
3. **`/admin/gameweeks`** — create Gameweek 1 with a deadline, set it to "Åpen".
4. **`/admin/fixtures`** — add fixtures for the gameweek with FDR ratings (1–5) for both sides.
5. Managers build squads at **`/squad`**, pick their XI/captain at **`/lineup`**, and can use rolling captain/rolling substitutions until every player in their squad has kicked off.
6. After matches are played, go to **`/admin/results`**, enter the final score and each player's stats (minutes, goals, assists — Gullhaug players only, cards, own goals), then hit **"Oppdater fantasy-poeng"**. This runs the scoring engine (`src/lib/scoring.ts`) for every player and every manager.
7. When the round is fully played out, go to **`/admin/gameweeks`** and click **"Fullfør"** — this rolls over free transfers (capped at 3) and automatically generates that round's Team of the Week.

## 6. Deploy

Push to GitHub, import into [Vercel](https://vercel.com), add the same three env vars in the Vercel project settings, deploy.

---

## About Min Fotball integration

Min Fotball does not expose a public API, and its pages are not reliably scrapeable long-term (structure changes, no stable endpoints). Rather than ship a scraper that breaks every few weeks, this build uses the **manual admin entry page** (`/admin/results`) as the primary, reliable path — this was the explicit fallback described in the spec, and given Min Fotball's constraints it's the trustworthy default. The `min_fotball_ref` column on `fixtures` is there if you want to paste in a link for your own reference when entering results.

If you (or Bendik) later find a workable way to pull data from Min Fotball automatically, the natural place to add it is a scheduled Vercel Cron job that writes into `fixtures` and `player_match_stats` — the scoring engine downstream doesn't care whether that data arrived by hand or by script.

## What's implemented

- Full Postgres schema with Row Level Security (`supabase/schema.sql`)
- Supabase Auth (signup/login/signout)
- Squad builder with budget, position quotas, max-4-per-team, min-2-per-Gullhaug-team validation (client **and** server-side)
- Starting XI / formation / captain / vice-captain / bench
- Rolling captain and rolling substitutions, enforced against fixture kickoff times
- Full scoring engine matching every rule in the spec: appearance, goals, assists (Gullhaug-only), clean sheets, goals-conceded deduction table, cards, own goals, scouting bonus
- Transfers with free-transfer bank (rollover, capped at 3) and -3 point paid transfers
- All four chips (Wildcard, Goal Rush, Super Defence, Away Advantage), one use per season each
- Private leagues with invite codes and standings
- Statistics page (top scorers, top managers, most/least owned, differentials, FDR, upcoming fixtures)
- Automatic Team of the Week generation and archive
- Admin dashboard: teams, players, fixtures (with FDR), match result + stats entry, gameweek lock/unlock
- Dark mode, purple/green theme, mobile-first responsive layout

## What you'll likely want to refine before the season starts

- **Player Form (last 5 matches)** on the statistics page is not yet computed — the data model supports it (`fantasy_points` per gameweek), it just needs a query added.
- **Head-to-head leagues** — the schema and standings page support classic overall/gameweek standings; head-to-head fixtures between league members would need an extra small table.
- **Monthly standings** — same data is there (`fantasy_team_gameweek_scores`), just needs a "group by month" query added to the leagues page.
- Automated Min Fotball scraping, as discussed above.
- Email confirmation flow for signups is left at Supabase's default settings — adjust in Supabase Dashboard → Authentication → Email templates if you want a custom look.
