import { createClient } from "@/lib/supabase/server";
import StatCard from "@/components/StatCard";
import FDRBadge from "@/components/FDRBadge";

export const revalidate = 120;

export default async function StatisticsPage() {
  const supabase = createClient();

  const { data: allSquadRows } = await supabase.from("fantasy_squad_players").select("player_id");
  const { data: totalTeams } = await supabase.from("fantasy_teams").select("id");
  const managerCount = totalTeams?.length ?? 0;

  const ownershipCount = new Map<string, number>();
  (allSquadRows ?? []).forEach((r) => ownershipCount.set(r.player_id, (ownershipCount.get(r.player_id) ?? 0) + 1));

  const { data: players } = await supabase.from("players").select("*, team:teams(*)").eq("is_active", true);
  const { data: fantasyPoints } = await supabase.from("fantasy_points").select("player_id, points");

  const totalsByPlayer = new Map<string, number>();
  (fantasyPoints ?? []).forEach((fp) => totalsByPlayer.set(fp.player_id, (totalsByPlayer.get(fp.player_id) ?? 0) + fp.points));

  const enriched = (players ?? []).map((p) => ({
    ...p,
    totalPoints: totalsByPlayer.get(p.id) ?? 0,
    ownershipPct: managerCount > 0 ? Math.round(((ownershipCount.get(p.id) ?? 0) / managerCount) * 1000) / 10 : 0,
  }));

  const topScorers = [...enriched].sort((a, b) => b.totalPoints - a.totalPoints).slice(0, 10);
  const mostOwned = [...enriched].sort((a, b) => b.ownershipPct - a.ownershipPct).slice(0, 10);
  const differentials = enriched
    .filter((p) => p.ownershipPct < 5 && p.totalPoints > 0)
    .sort((a, b) => b.totalPoints - a.totalPoints)
    .slice(0, 10);

  const { data: teamScores } = await supabase.from("fantasy_team_gameweek_scores").select("fantasy_team_id, net_points");
  const { data: teams } = await supabase.from("fantasy_teams").select("id, team_name");
  const managerTotals = new Map<string, number>();
  (teamScores ?? []).forEach((s) => managerTotals.set(s.fantasy_team_id, (managerTotals.get(s.fantasy_team_id) ?? 0) + s.net_points));
  const topManagers = (teams ?? [])
    .map((t) => ({ ...t, total: managerTotals.get(t.id) ?? 0 }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);

  const { data: upcomingFixtures } = await supabase
    .from("fixtures")
    .select("*, home_team:teams!fixtures_home_team_id_fkey(*), away_team:teams!fixtures_away_team_id_fkey(*)")
    .eq("is_final", false)
    .order("kickoff_at")
    .limit(6);

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <h1 className="font-display text-2xl font-black text-white">Statistikk</h1>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard label="Managere" value={managerCount} />
        <StatCard label="Spillere i puljen" value={players?.length ?? 0} accent="emerald" />
        <StatCard label="Differensialer" value={differentials.length} />
      </div>

      <Section title="Høyest scorende spillere">
        {topScorers.map((p, i) => (
          <Row key={p.id} rank={i + 1} label={p.name} sub={p.team?.name} value={`${p.totalPoints} p`} />
        ))}
      </Section>

      <Section title="Høyest scorende managere">
        {topManagers.map((t, i) => (
          <Row key={t.id} rank={i + 1} label={t.team_name} value={`${t.total} p`} />
        ))}
      </Section>

      <Section title="Mest valgte spillere">
        {mostOwned.map((p, i) => (
          <Row key={p.id} rank={i + 1} label={p.name} sub={p.team?.name} value={`${p.ownershipPct}%`} />
        ))}
      </Section>

      <Section title="Toppdifferensialer (under 5% eid)">
        {differentials.map((p, i) => (
          <Row key={p.id} rank={i + 1} label={p.name} sub={p.team?.name} value={`${p.totalPoints} p · ${p.ownershipPct}%`} />
        ))}
        {differentials.length === 0 && <p className="px-4 py-3 text-sm text-slate-500">Ingen differensialer ennå.</p>}
      </Section>

      <Section title="Kommende kamper — vanskelighetsgrad (FDR)">
        <div className="space-y-2 p-4">
          {(upcomingFixtures ?? []).map((f: any) => (
            <div key={f.id} className="flex items-center justify-between text-sm text-white">
              <span className="flex items-center gap-2">
                {f.home_team?.name} <FDRBadge rating={f.home_fdr} />
              </span>
              <span className="text-slate-600">vs</span>
              <span className="flex items-center gap-2">
                <FDRBadge rating={f.away_fdr} /> {f.away_team?.name}
              </span>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-6">
      <h2 className="text-sm font-bold text-slate-400">{title}</h2>
      <div className="mt-2 divide-y divide-pitch-border rounded-xl border border-pitch-border bg-pitch-surface">{children}</div>
    </div>
  );
}

function Row({ rank, label, sub, value }: { rank: number; label: string; sub?: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5">
      <div className="flex items-center gap-3">
        <span className="w-5 text-xs font-bold text-slate-600">{rank}</span>
        <div>
          <div className="text-sm font-semibold text-white">{label}</div>
          {sub && <div className="text-xs text-slate-500">{sub}</div>}
        </div>
      </div>
      <span className="font-mono text-sm font-bold text-emerald-400">{value}</span>
    </div>
  );
}
