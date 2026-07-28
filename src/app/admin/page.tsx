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
      <h1 className="font-display text-2xl font-black text-white">Admin-oversikt</h1>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Lag" value={teamCount ?? 0} />
        <StatCard label="Spillere" value={playerCount ?? 0} accent="emerald" />
        <StatCard label="Managere" value={managerCount ?? 0} />
        <StatCard label="Aktiv runde" value={currentGw?.number ?? "–"} accent="emerald" />
      </div>
      <p className="mt-6 text-sm text-slate-500">
        Bruk menyen til venstre for å legge inn lag, spillere, kamper og resultater. Poeng oppdateres automatisk
        når du registrerer resultater under "Registrer resultater".
      </p>
    </div>
  );
}
