"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import FDRBadge from "@/components/FDRBadge";

interface PlayerStats {
  player: any;
  goals: number;
  assists: number;
  matches: number;
  totalPoints: number;
  ownershipPct: number;
  nextFixtures: { opponent: string; fdr: number; isHome: boolean }[];
}

export default function ComparePage() {
  const supabase = createClient();
  const [players, setPlayers] = useState<any[]>([]);
  const [leftId, setLeftId] = useState("");
  const [rightId, setRightId] = useState("");
  const [leftStats, setLeftStats] = useState<PlayerStats | null>(null);
  const [rightStats, setRightStats] = useState<PlayerStats | null>(null);
  const [managerCount, setManagerCount] = useState(1);

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from("players").select("*, team:teams(*)").eq("is_active", true).order("name");
      setPlayers(data ?? []);
      const { count } = await supabase.from("fantasy_teams").select("*", { count: "exact", head: true });
      setManagerCount(count || 1);
    }
    load();
  }, [supabase]);

  async function loadStats(playerId: string): Promise<PlayerStats | null> {
    if (!playerId) return null;
    const player = players.find((p) => p.id === playerId);
    if (!player) return null;

    const { data: matchStats } = await supabase.from("player_match_stats").select("*").eq("player_id", playerId);
    const goals = (matchStats ?? []).reduce((s, m) => s + m.goals, 0);
    const assists = (matchStats ?? []).reduce((s, m) => s + m.assists, 0);
    const matches = (matchStats ?? []).filter((m) => m.minutes_played > 0).length;

    const { data: fp } = await supabase.from("fantasy_points").select("points").eq("player_id", playerId);
    const totalPoints = (fp ?? []).reduce((s, p) => s + p.points, 0);

    const { count: ownedCount } = await supabase.from("fantasy_squad_players").select("*", { count: "exact", head: true }).eq("player_id", playerId);
    const ownershipPct = ((ownedCount ?? 0) / managerCount) * 100;

    const { data: fixtures } = await supabase
      .from("fixtures")
      .select("*, home_team:teams!fixtures_home_team_id_fkey(*), away_team:teams!fixtures_away_team_id_fkey(*)")
      .or(`home_team_id.eq.${player.team_id},away_team_id.eq.${player.team_id}`)
      .eq("is_final", false)
      .order("kickoff_at", { ascending: true })
      .limit(3);
    const nextFixtures = (fixtures ?? []).map((f: any) => ({
      opponent: f.home_team_id === player.team_id ? f.away_team?.name : f.home_team?.name,
      fdr: f.home_team_id === player.team_id ? f.home_fdr : f.away_fdr,
      isHome: f.home_team_id === player.team_id,
    }));

    return { player, goals, assists, matches, totalPoints, ownershipPct, nextFixtures };
  }

  useEffect(() => {
    if (leftId) loadStats(leftId).then(setLeftStats);
    else setLeftStats(null);
  }, [leftId, players, managerCount]);

  useEffect(() => {
    if (rightId) loadStats(rightId).then(setRightStats);
    else setRightStats(null);
  }, [rightId, players, managerCount]);

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="font-display text-2xl font-black text-white">Compare Players</h1>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <select value={leftId} onChange={(e) => setLeftId(e.target.value)} className="rounded-lg border border-pitch-border bg-pitch-surface px-3 py-2 text-sm text-white outline-none focus:border-violet-500">
          <option value="">Player A</option>
          {players.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select value={rightId} onChange={(e) => setRightId(e.target.value)} className="rounded-lg border border-pitch-border bg-pitch-surface px-3 py-2 text-sm text-white outline-none focus:border-violet-500">
          <option value="">Player B</option>
          {players.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      {leftStats && rightStats && (
        <div className="mt-6 space-y-2">
          <Row label="Team" left={leftStats.player.team?.name} right={rightStats.player.team?.name} />
          <Row label="Price" left={`${leftStats.player.price.toFixed(1)}M`} right={`${rightStats.player.price.toFixed(1)}M`} />
          <Row label="Goals" left={leftStats.goals} right={rightStats.goals} highlight />
          <Row label="Assists" left={leftStats.assists} right={rightStats.assists} highlight />
          <Row label="Fantasy points" left={leftStats.totalPoints} right={rightStats.totalPoints} highlight />
          <Row label="Avg points/match" left={leftStats.matches ? (leftStats.totalPoints / leftStats.matches).toFixed(1) : "—"} right={rightStats.matches ? (rightStats.totalPoints / rightStats.matches).toFixed(1) : "—"} />
          <Row label="Goals/match" left={leftStats.matches ? (leftStats.goals / leftStats.matches).toFixed(2) : "—"} right={rightStats.matches ? (rightStats.goals / rightStats.matches).toFixed(2) : "—"} />
          <Row label="Ownership" left={`${leftStats.ownershipPct.toFixed(1)}%`} right={`${rightStats.ownershipPct.toFixed(1)}%`} />

          <div className="grid grid-cols-2 gap-3 pt-2">
            {[leftStats, rightStats].map((s, i) => (
              <div key={i} className="rounded-lg bg-pitch-surface border border-pitch-border p-3">
                <div className="text-xs font-bold text-slate-400 mb-1">Next fixtures</div>
                {s.nextFixtures.map((f, j) => (
                  <div key={j} className="flex items-center gap-1 text-xs text-slate-300 py-0.5">
                    {f.isHome ? "vs" : "@"} {f.opponent} <FDRBadge rating={f.fdr} />
                  </div>
                ))}
                {s.nextFixtures.length === 0 && <div className="text-xs text-slate-600">None scheduled</div>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, left, right, highlight }: { label: string; left: any; right: any; highlight?: boolean }) {
  const leftWins = highlight && typeof left === "number" && typeof right === "number" && left > right;
  const rightWins = highlight && typeof left === "number" && typeof right === "number" && right > left;
  return (
    <div className="grid grid-cols-3 items-center rounded-lg bg-pitch-surface border border-pitch-border px-3 py-2 text-sm">
      <span className={`font-mono font-bold ${leftWins ? "text-emerald-400" : "text-white"}`}>{left}</span>
      <span className="text-center text-xs text-slate-500">{label}</span>
      <span className={`text-right font-mono font-bold ${rightWins ? "text-emerald-400" : "text-white"}`}>{right}</span>
    </div>
  );
}
