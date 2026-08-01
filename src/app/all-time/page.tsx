"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import StatCard from "@/components/StatCard";
import { Trophy, Medal } from "lucide-react";

type Tab = "career" | "hof" | "records";

export default function AllTimePage() {
  const supabase = createClient();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("career");
  const [loading, setLoading] = useState(true);

  const [career, setCareer] = useState<any>(null);
  const [hof, setHof] = useState<any[]>([]);
  const [records, setRecords] = useState<any>(null);

  useEffect(() => {
    async function load() {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        router.push("/login");
        return;
      }
      const { data: team } = await supabase.from("fantasy_teams").select("*").eq("user_id", userData.user.id).single();

      if (team) {
        const [{ data: champ }, { data: runnerUp }, { data: third }, { data: bestGw }, { data: lineups }, { data: squadPlayers }, { data: transfers }, { data: chips }, { data: achievementsUnlocked }, { count: seasonsPlayed }] =
          await Promise.all([
            supabase.from("hall_of_fame").select("id").eq("champion_team_id", team.id),
            supabase.from("hall_of_fame").select("id").eq("runner_up_team_id", team.id),
            supabase.from("hall_of_fame").select("id").eq("third_place_team_id", team.id),
            supabase.from("fantasy_team_gameweek_scores").select("net_points").eq("fantasy_team_id", team.id).order("net_points", { ascending: false }).limit(1),
            supabase.from("gameweek_lineups").select("formation").eq("fantasy_team_id", team.id),
            supabase.from("fantasy_squad_players").select("player:players(*, team:teams(*))").eq("fantasy_team_id", team.id),
            supabase.from("transfers").select("id").eq("fantasy_team_id", team.id),
            supabase.from("chip_usages").select("chip").eq("fantasy_team_id", team.id),
            supabase.from("manager_achievements").select("id").eq("fantasy_team_id", team.id),
            supabase.from("seasons").select("*", { count: "exact", head: true }),
          ]);

        const formationCounts = new Map<string, number>();
        (lineups ?? []).forEach((l: any) => formationCounts.set(l.formation, (formationCounts.get(l.formation) ?? 0) + 1));
        const favouriteFormation = [...formationCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";

        const teamCounts = new Map<string, number>();
        (squadPlayers ?? []).forEach((r: any) => {
          const name = r.player?.team?.name;
          if (name) teamCounts.set(name, (teamCounts.get(name) ?? 0) + 1);
        });
        const favouriteClub = [...teamCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";

        setCareer({
          teamName: team.team_name,
          seasonsPlayed: seasonsPlayed ?? 1,
          titles: champ?.length ?? 0,
          runnerUp: runnerUp?.length ?? 0,
          top3: (champ?.length ?? 0) + (runnerUp?.length ?? 0) + (third?.length ?? 0),
          bestGw: bestGw?.[0]?.net_points ?? "—",
          totalTransfers: transfers?.length ?? 0,
          favouriteFormation,
          favouriteClub,
          chipsUsed: (chips ?? []).map((c: any) => c.chip),
          achievementsCount: achievementsUnlocked?.length ?? 0,
        });
      }

      const { data: hofRows } = await supabase
        .from("hall_of_fame")
        .select(`*, season:seasons(*), champion:fantasy_teams!hall_of_fame_champion_team_id_fkey(team_name), runner_up:fantasy_teams!hall_of_fame_runner_up_team_id_fkey(team_name), third:fantasy_teams!hall_of_fame_third_place_team_id_fkey(team_name)`)
        .order("created_at", { ascending: false });
      setHof(hofRows ?? []);

      const { data: allScores } = await supabase.from("fantasy_team_gameweek_scores").select("*, fantasy_team:fantasy_teams(team_name), gameweek:gameweeks(number)").order("net_points", { ascending: false }).limit(1);
      const { data: players } = await supabase.from("players").select("id, name, position");
      const { data: allFp } = await supabase.from("fantasy_points").select("player_id, points");
      const totals = new Map<string, number>();
      (allFp ?? []).forEach((fp: any) => totals.set(fp.player_id, (totals.get(fp.player_id) ?? 0) + fp.points));
      const topByPos = (pos: string) => {
        let best: { name: string; points: number } | null = null;
        (players ?? []).filter((p: any) => p.position === pos).forEach((p: any) => {
          const total = totals.get(p.id) ?? 0;
          if (!best || total > best.points) best = { name: p.name, points: total };
        });
        return best;
      };
      const { data: statsRows } = await supabase.from("player_match_stats").select("player_id, goals, clean_sheet");
      const goalsByPlayer = new Map<string, number>();
      const csByPlayer = new Map<string, number>();
      (statsRows ?? []).forEach((s: any) => {
        goalsByPlayer.set(s.player_id, (goalsByPlayer.get(s.player_id) ?? 0) + s.goals);
        if (s.clean_sheet) csByPlayer.set(s.player_id, (csByPlayer.get(s.player_id) ?? 0) + 1);
      });
      const nameById = new Map((players ?? []).map((p: any) => [p.id, p.name]));
      const mostGoals = [...goalsByPlayer.entries()].sort((a, b) => b[1] - a[1])[0];
      const mostCS = [...csByPlayer.entries()].sort((a, b) => b[1] - a[1])[0];

      setRecords({
        bestGwEver: allScores?.[0] ? `${allScores[0].net_points} pts — ${allScores[0].fantasy_team?.team_name} (GW${allScores[0].gameweek?.number})` : "—",
        gk: topByPos("GK"),
        def: topByPos("DEF"),
        mid: topByPos("MID"),
        fwd: topByPos("FWD"),
        mostGoals: mostGoals ? `${nameById.get(mostGoals[0])} — ${mostGoals[1]}` : "—",
        mostCS: mostCS ? `${nameById.get(mostCS[0])} — ${mostCS[1]}` : "—",
      });

      setLoading(false);
    }
    load();
  }, [supabase, router]);

  if (loading) return <div className="mx-auto max-w-2xl px-4 py-10 text-slate-500">Loading…</div>;

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="font-display text-2xl font-black text-slate-900">All-Time</h1>

      <div className="mt-4 flex gap-2">
        {(["career", "hof", "records"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-full px-4 py-2 text-sm font-bold ${tab === t ? "bg-violet-600 text-white" : "bg-pitch-surface border border-pitch-border text-slate-500"}`}
          >
            {t === "career" ? "Your Career" : t === "hof" ? "Hall of Fame" : "Global Records"}
          </button>
        ))}
      </div>

      {tab === "career" && career && (
        <div className="mt-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <StatCard label="Seasons played" value={career.seasonsPlayed} />
            <StatCard label="League titles" value={career.titles} accent="emerald" />
            <StatCard label="Runner-up finishes" value={career.runnerUp} />
            <StatCard label="Top 3 finishes" value={career.top3} accent="emerald" />
            <StatCard label="Best ever gameweek" value={career.bestGw} />
            <StatCard label="Total transfers" value={career.totalTransfers} />
            <StatCard label="Favourite formation" value={career.favouriteFormation} accent="emerald" />
            <StatCard label="Favourite club" value={career.favouriteClub} />
            <StatCard label="Achievements" value={`${career.achievementsCount}/11`} accent="emerald" />
          </div>
          <div className="mt-4">
            <h2 className="text-sm font-bold text-slate-500">Chips used</h2>
            <div className="mt-2 flex flex-wrap gap-2">
              {career.chipsUsed.map((c: string, i: number) => (
                <span key={i} className="rounded-full bg-violet-500/15 border border-violet-500/30 px-3 py-1 text-xs font-bold text-violet-300">
                  {c.replace("_", " ")}
                </span>
              ))}
              {career.chipsUsed.length === 0 && <span className="text-xs text-slate-400">None used yet</span>}
            </div>
          </div>
        </div>
      )}

      {tab === "hof" && (
        <div className="mt-5 space-y-6">
          {hof.map((h: any) => (
            <div key={h.id} className="rounded-2xl border border-pitch-border bg-gradient-to-br from-violet-600/10 to-emerald-600/10 p-5">
              <h2 className="font-display text-lg font-bold text-slate-900">Season {h.season?.label}</h2>
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                <Podium place={1} icon={<Trophy size={16} className="text-amber-400" />} name={h.champion?.team_name} />
                <Podium place={2} icon={<Medal size={16} className="text-slate-700" />} name={h.runner_up?.team_name} />
                <Podium place={3} icon={<Medal size={16} className="text-orange-400" />} name={h.third?.team_name} />
              </div>
            </div>
          ))}
          {hof.length === 0 && <p className="text-sm text-slate-500">No completed seasons archived yet.</p>}
        </div>
      )}

      {tab === "records" && records && (
        <div className="mt-5 space-y-2">
          <Record label="Highest ever gameweek" value={records.bestGwEver} />
          <Record label="Highest scoring goalkeeper" value={records.gk ? `${records.gk.name} — ${records.gk.points} pts` : "—"} />
          <Record label="Highest scoring defender" value={records.def ? `${records.def.name} — ${records.def.points} pts` : "—"} />
          <Record label="Highest scoring midfielder" value={records.mid ? `${records.mid.name} — ${records.mid.points} pts` : "—"} />
          <Record label="Highest scoring forward" value={records.fwd ? `${records.fwd.name} — ${records.fwd.points} pts` : "—"} />
          <Record label="Most goals" value={records.mostGoals} />
          <Record label="Most clean sheets" value={records.mostCS} />
        </div>
      )}
    </div>
  );
}

function Podium({ place, icon, name }: { place: number; icon: React.ReactNode; name?: string }) {
  return (
    <div className="rounded-lg bg-pitch-surface border border-pitch-border px-3 py-2 text-center">
      <div className="flex items-center justify-center gap-1 text-xs text-slate-500">{icon} #{place}</div>
      <div className="mt-1 text-sm font-bold text-slate-900">{name ?? "—"}</div>
    </div>
  );
}

function Record({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-pitch-border bg-pitch-surface px-4 py-3">
      <span className="text-sm text-slate-500">{label}</span>
      <span className="text-right text-sm font-bold text-slate-900">{value}</span>
    </div>
  );
}
