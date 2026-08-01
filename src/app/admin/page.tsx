import { createClient } from "@/lib/supabase/server";
import StatCard from "@/components/StatCard";

export default async function AdminOverview() {
  const supabase = createClient();
  const [{ count: teamCount }, { count: playerCount }, { count: managerCount }, { data: currentGw }] = await Promise.all([
    supabase.from("teams").select("*", { count: "exact", head: true }),
    supabase.from("players").select("*", { count: "exact", head: true }),
    supabase.from("fantasy_teams").select("*", { count: "exact", head: true }),
    supabase.from("gameweeks").select("*").in("status", ["open", "in_progress"]).order("number").limit(1).maybeSingle(),
  ]);

  return (
    <div>
      <h1 className="font-display text-2xl font-black text-slate-900">Admin Overview</h1>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Teams" value={teamCount ?? 0} />
        <StatCard label="Players" value={playerCount ?? 0} accent="emerald" />
        <StatCard label="Managers" value={managerCount ?? 0} />
        <StatCard label="Active gameweek" value={currentGw?.number ?? "–"} accent="emerald" />
      </div>
      <p className="mt-6 text-sm text-slate-500">
        Use the menu on the left to add teams, players, fixtures, and results. Points update automatically
        whenever you enter results under "Enter Results".
      </p>
    </div>
  );
}
