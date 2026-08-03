"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { FORMATIONS, Player, ChipType } from "@/types";
import { isValidFormationCounts } from "@/lib/scoring";
import { teamAbbrev } from "@/lib/teamAbbrev";
import FDRBadge from "@/components/FDRBadge";
import DeadlineCountdown from "@/components/DeadlineCountdown";
import { Zap, ArrowLeftRight, X, Info } from "lucide-react";

interface SquadPlayer extends Player {
  nextFdr?: number;
  nextOpponent?: string;
  nextIsHome?: boolean;
  livePoints?: number;
}

const CHIP_LIST: { id: ChipType; name: string }[] = [
  { id: "wildcard", name: "Wildcard" },
  { id: "goal_rush", name: "Goal Rush" },
  { id: "super_defence", name: "Super Defence" },
  { id: "away_advantage", name: "Away Advantage" },
];

export default function PickTeamPage() {
  const supabase = createClient();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [teamMeta, setTeamMeta] = useState<{ team_name: string; budget_remaining: number; free_transfers: number } | null>(null);
  const [usedChips, setUsedChips] = useState<ChipType[]>([]);
  const [fantasyTeamId, setFantasyTeamId] = useState<string | null>(null);
  const [gameweekId, setGameweekId] = useState<string | null>(null);
  const [gameweekNumber, setGameweekNumber] = useState<number | null>(null);
  const [gameweekDeadline, setGameweekDeadline] = useState<string | null>(null);
  const [isLive, setIsLive] = useState(false);
  const [squad, setSquad] = useState<SquadPlayer[]>([]);
  const [formation, setFormation] = useState("4-4-2");
  const [starters, setStarters] = useState<string[]>([]);
  const [captain, setCaptain] = useState<string | null>(null);
  const [vice, setVice] = useState<string | null>(null);
  const [selectedForSwap, setSelectedForSwap] = useState<string | null>(null);
  const [infoPlayerId, setInfoPlayerId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        router.push("/login");
        return;
      }
      const { data: team } = await supabase.from("fantasy_teams").select("*").eq("user_id", userData.user.id).single();
      if (!team) {
        router.push("/squad");
        return;
      }
      setFantasyTeamId(team.id);
      setTeamMeta(team);

      const { data: chipRows } = await supabase.from("chip_usages").select("chip").eq("fantasy_team_id", team.id);
      setUsedChips((chipRows ?? []).map((c: any) => c.chip));

      const { data: squadRows } = await supabase
        .from("fantasy_squad_players")
        .select("player:players(*, team:teams(*))")
        .eq("fantasy_team_id", team.id);
      if (!squadRows || squadRows.length < 15) {
        router.push("/squad");
        return;
      }
      let squadPlayers: SquadPlayer[] = squadRows.map((r: any) => r.player);

      const { data: upcomingFixtures } = await supabase
        .from("fixtures")
        .select("*, home_team:teams!fixtures_home_team_id_fkey(*), away_team:teams!fixtures_away_team_id_fkey(*)")
        .eq("is_final", false)
        .order("kickoff_at", { ascending: true });
      squadPlayers = squadPlayers.map((p) => {
        const next = (upcomingFixtures ?? []).find((f: any) => f.home_team_id === p.team_id || f.away_team_id === p.team_id);
        if (!next) return p;
        const isHome = next.home_team_id === p.team_id;
        return { ...p, nextFdr: isHome ? next.home_fdr : next.away_fdr, nextOpponent: isHome ? next.away_team?.name : next.home_team?.name, nextIsHome: isHome };
      });

      const { data: gw } = await supabase
        .from("gameweeks")
        .select("*")
        .in("status", ["upcoming", "open", "in_progress"])
        .order("number", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (gw) {
        setGameweekId(gw.id);
        setGameweekNumber(gw.number);
        setGameweekDeadline(gw.deadline_at);
        setIsLive(gw.status === "in_progress");

        if (gw.status === "in_progress") {
          const { data: livePts } = await supabase.from("fantasy_points").select("player_id, points").eq("gameweek_id", gw.id);
          const liveMap = new Map((livePts ?? []).map((p: any) => [p.player_id, p.points]));
          squadPlayers = squadPlayers.map((p) => ({ ...p, livePoints: liveMap.get(p.id) }));
        }

        const { data: existing } = await supabase
          .from("gameweek_lineups")
          .select("*, slots:gameweek_lineup_slots(*)")
          .eq("fantasy_team_id", team.id)
          .eq("gameweek_id", gw.id)
          .maybeSingle();
        if (existing) {
          setFormation(existing.formation);
          setCaptain(existing.captain_player_id);
          setVice(existing.vice_captain_player_id);
          setStarters((existing.slots ?? []).filter((s: any) => s.is_starter).map((s: any) => s.player_id));
        } else {
          const need = FORMATIONS[formation];
          const gk = squadPlayers.filter((p) => p.position === "GK").slice(0, 1);
          const def = squadPlayers.filter((p) => p.position === "DEF").slice(0, need.DEF);
          const mid = squadPlayers.filter((p) => p.position === "MID").slice(0, need.MID);
          const fwd = squadPlayers.filter((p) => p.position === "FWD").slice(0, need.FWD);
          setStarters([...gk, ...def, ...mid, ...fwd].map((p) => p.id));
        }
      }

      setSquad(squadPlayers);
      setLoading(false);
    }
    load();
  }, [supabase, router]);

  const need = FORMATIONS[formation];
  const starterIn = (pos: string) => squad.filter((p) => starters.includes(p.id) && p.position === pos);
  const bench = squad.filter((p) => !starters.includes(p.id));
  const startCount = (pos: string) => starterIn(pos).length;

  const lineupValid = isValidFormationCounts(
    { GK: startCount("GK"), DEF: startCount("DEF"), MID: startCount("MID"), FWD: startCount("FWD") },
    need
  );

  function tapPlayer(player: SquadPlayer) {
    const isStarter = starters.includes(player.id);

    if (!selectedForSwap) {
      setSelectedForSwap(player.id);
      return;
    }
    if (selectedForSwap === player.id) {
      setSelectedForSwap(null);
      return;
    }
    const selectedPlayer = squad.find((p) => p.id === selectedForSwap);
    if (!selectedPlayer) {
      setSelectedForSwap(null);
      return;
    }
    const selectedIsStarter = starters.includes(selectedForSwap);
    if (selectedIsStarter !== isStarter && selectedPlayer.position === player.position) {
      setStarters((prev) => {
        const withoutBoth = prev.filter((id) => id !== selectedForSwap && id !== player.id);
        const incoming = selectedIsStarter ? player.id : selectedForSwap;
        return [...withoutBoth, incoming];
      });
      const benchedId = selectedIsStarter ? selectedForSwap : player.id;
      if (captain === benchedId) setCaptain(null);
      if (vice === benchedId) setVice(null);
    }
    setSelectedForSwap(null);
  }

  function setFormationAndReconcile(f: string) {
    setFormation(f);
    setSelectedForSwap(null);
    const need2 = FORMATIONS[f];
    const gk = squad.filter((p) => p.position === "GK" && starters.includes(p.id)).slice(0, 1);
    const def = squad.filter((p) => p.position === "DEF" && starters.includes(p.id)).slice(0, need2.DEF);
    const mid = squad.filter((p) => p.position === "MID" && starters.includes(p.id)).slice(0, need2.MID);
    const fwd = squad.filter((p) => p.position === "FWD" && starters.includes(p.id)).slice(0, need2.FWD);
    let picked = [...gk, ...def, ...mid, ...fwd];
    (["GK", "DEF", "MID", "FWD"] as const).forEach((pos) => {
      const target = pos === "GK" ? 1 : need2[pos];
      const current = picked.filter((p) => p.position === pos);
      if (current.length < target) {
        const extra = squad.filter((p) => p.position === pos && !picked.includes(p)).slice(0, target - current.length);
        picked = [...picked, ...extra];
      }
    });
    setStarters(picked.map((p) => p.id));
  }

  async function save() {
    if (!fantasyTeamId || !gameweekId || !lineupValid || !captain || !vice) return;
    setSaving(true);
    setMessage(null);
    const res = await fetch("/api/lineup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fantasy_team_id: fantasyTeamId,
        gameweek_id: gameweekId,
        formation,
        starters,
        bench: bench.map((p) => p.id),
        captain_player_id: captain,
        vice_captain_player_id: vice,
      }),
    });
    const body = await res.json();
    setSaving(false);
    setMessage(res.ok ? "Lineup saved!" : body.error ?? "Something went wrong.");
  }

  const infoPlayer = squad.find((p) => p.id === infoPlayerId) ?? null;

  if (loading) return <div className="mx-auto max-w-2xl px-4 py-10 text-slate-500">Loading…</div>;
  if (!gameweekId) return <div className="mx-auto max-w-2xl px-4 py-10 text-slate-500">No open gameweek right now.</div>;

  return (
    <div className="mx-auto max-w-2xl px-4 pb-32 pt-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-black text-slate-900">{teamMeta?.team_name}</h1>
        <span className="text-xs font-bold text-slate-500">GW{gameweekNumber}</span>
      </div>

      {gameweekDeadline && !isLive && (
        <div className="mt-2">
          <DeadlineCountdown deadline={gameweekDeadline} gameweekNumber={gameweekNumber ?? 0} />
        </div>
      )}
      {isLive && (
        <div className="mt-2 rounded-lg bg-rose-50 border border-rose-200 px-3 py-1.5 text-center text-xs font-bold text-rose-700">
          🔴 Gameweek {gameweekNumber} is live — points update as matches finish
        </div>
      )}

      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <MiniStat label="Team value" value={`${squad.reduce((s, p) => s + p.price, 0).toFixed(1)}M`} />
        <MiniStat label="Bank" value={`${(teamMeta?.budget_remaining ?? 0).toFixed(1)}M`} />
        <MiniStat label="Free transfers" value={String(teamMeta?.free_transfers ?? 0)} />
      </div>

      {/* Available chips */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {CHIP_LIST.map((c) => {
          const used = usedChips.includes(c.id);
          return (
            <span
              key={c.id}
              className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-bold ${
                used ? "border-pitch-border bg-pitch-surface text-slate-400" : "border-amber-200 bg-amber-50 text-amber-700"
              }`}
            >
              <Zap size={10} /> {c.name} {used && "(used)"}
            </span>
          );
        })}
      </div>

      <div className="mt-4 flex gap-2 overflow-x-auto">
        {Object.keys(FORMATIONS).map((f) => (
          <button
            key={f}
            onClick={() => setFormationAndReconcile(f)}
            className={`shrink-0 rounded-full border px-4 py-2 text-sm font-bold ${
              formation === f ? "border-emerald-400 bg-emerald-500 text-slate-950" : "border-pitch-border bg-pitch-surface text-slate-500"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {selectedForSwap && (
        <div className="mt-3 flex items-center gap-2 rounded-lg bg-slate-100 border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-600">
          <ArrowLeftRight size={14} />
          Tap another player of the same position to swap — or tap them again to cancel.
        </div>
      )}

      {/* The pitch */}
      <div className="mt-4 rounded-2xl bg-gradient-to-b from-emerald-800 to-emerald-900 border border-emerald-700/50 p-3 relative overflow-hidden">
        <div className="absolute inset-3 border border-white/15 rounded-lg pointer-events-none" />
        <div className="relative z-10 space-y-4 py-3">
          {(["GK", "DEF", "MID", "FWD"] as const).map((pos) => (
            <div key={pos} className="flex justify-center gap-2 flex-wrap">
              {starterIn(pos).map((p) => (
                <PitchToken
                  key={p.id}
                  player={p}
                  isCaptain={captain === p.id}
                  isVice={vice === p.id}
                  selected={selectedForSwap === p.id}
                  onTap={() => tapPlayer(p)}
                  onInfo={() => setInfoPlayerId(p.id)}
                  onSetCaptain={() => {
                    setCaptain(p.id);
                    if (vice === p.id) setVice(null);
                  }}
                  onSetVice={() => {
                    setVice(p.id);
                    if (captain === p.id) setCaptain(null);
                  }}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      {!lineupValid && <p className="mt-2 text-center text-xs text-amber-600">Formation needs {need.DEF} DEF / {need.MID} MID / {need.FWD} FWD starting.</p>}

      {/* Bench */}
      <div className="mt-5">
        <div className="mb-2 text-xs font-bold text-slate-500">Bench</div>
        <div className="flex flex-wrap gap-2">
          {bench.map((p) => (
            <PitchToken key={p.id} player={p} bench selected={selectedForSwap === p.id} onTap={() => tapPlayer(p)} onInfo={() => setInfoPlayerId(p.id)} />
          ))}
        </div>
      </div>

      <div className="fixed bottom-16 left-0 right-0 border-t border-pitch-border bg-pitch/95 backdrop-blur md:bottom-0">
        <div className="mx-auto max-w-2xl px-4 py-3">
          {!captain && lineupValid && <p className="mb-2 text-center text-xs text-amber-600">Tap C on a starter to set Captain, VC for Vice Captain.</p>}
          {message && <p className="mb-2 text-center text-xs text-emerald-600">{message}</p>}
          <button
            onClick={save}
            disabled={!lineupValid || !captain || !vice || saving}
            className="w-full rounded-xl bg-slate-900 py-3 font-bold text-white hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-400"
          >
            {saving ? "Saving…" : "Save lineup"}
          </button>
        </div>
      </div>

      {infoPlayer && <PlayerInfoPanel player={infoPlayer} onClose={() => setInfoPlayerId(null)} />}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-pitch-surface border border-pitch-border py-2">
      <div className="text-[10px] text-slate-500">{label}</div>
      <div className="font-mono text-sm font-bold text-slate-900">{value}</div>
    </div>
  );
}

function PitchToken({
  player,
  isCaptain,
  isVice,
  selected,
  bench,
  onTap,
  onInfo,
  onSetCaptain,
  onSetVice,
}: {
  player: SquadPlayer;
  isCaptain?: boolean;
  isVice?: boolean;
  selected?: boolean;
  bench?: boolean;
  onTap: () => void;
  onInfo: () => void;
  onSetCaptain?: () => void;
  onSetVice?: () => void;
}) {
  return (
    <div
      onClick={onTap}
      className={`relative flex w-[92px] flex-col items-center rounded-xl border px-1.5 py-2 text-center cursor-pointer transition ${
        selected
          ? "border-slate-400 bg-slate-200 ring-2 ring-slate-400"
          : bench
          ? "border-pitch-border bg-pitch-surface/80"
          : "border-white/20 bg-black/30 backdrop-blur"
      }`}
    >
      <button
        onClick={(e) => {
          e.stopPropagation();
          onInfo();
        }}
        className="absolute -top-1.5 -right-1.5 rounded-full bg-white p-0.5 text-slate-600 shadow-card"
      >
        <Info size={11} />
      </button>
      <div className="flex items-center gap-1">
        {player.team?.color && <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: player.team.color }} />}
        <span className="text-[9px] font-bold text-slate-300">{teamAbbrev(player.team?.name)}</span>
      </div>
      <div className="truncate w-full text-[11px] font-bold text-white">{player.name.split(" ").slice(-1)[0]}</div>
      <div className="text-[9px] text-slate-400">
        {player.nextOpponent ? `${player.nextIsHome ? "H" : "A"} ${teamAbbrev(player.nextOpponent)}` : "No fixture"}
      </div>
      {player.livePoints !== undefined && <div className="mt-0.5 font-mono text-xs font-black text-emerald-400">{player.livePoints}p</div>}
      {!bench && (
        <div className="mt-1 flex gap-1" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={onSetCaptain}
            className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${isCaptain ? "bg-amber-500 text-slate-950" : "bg-white/10 text-slate-300"}`}
          >
            C
          </button>
          <button
            onClick={onSetVice}
            className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${isVice ? "bg-sky-500 text-slate-950" : "bg-white/10 text-slate-300"}`}
          >
            VC
          </button>
        </div>
      )}
    </div>
  );
}

function PlayerInfoPanel({ player, onClose }: { player: SquadPlayer; onClose: () => void }) {
  const supabase = createClient();
  const [stats, setStats] = useState<{
    goals: number;
    assists: number;
    cleanSheets: number;
    totalPoints: number;
    avgPoints: number;
    ownershipPct: number;
    form: number;
  } | null>(null);

  useEffect(() => {
    async function load() {
      const [{ data: matchStats }, { data: fp }, { count: ownedCount }, { count: managerCount }] = await Promise.all([
        supabase.from("player_match_stats").select("goals, assists, clean_sheet").eq("player_id", player.id),
        supabase.from("fantasy_points").select("points, gameweek:gameweeks(number)").eq("player_id", player.id),
        supabase.from("fantasy_squad_players").select("*", { count: "exact", head: true }).eq("player_id", player.id),
        supabase.from("fantasy_teams").select("*", { count: "exact", head: true }),
      ]);
      const goals = (matchStats ?? []).reduce((s, m) => s + m.goals, 0);
      const assists = (matchStats ?? []).reduce((s, m) => s + m.assists, 0);
      const cleanSheets = (matchStats ?? []).filter((m) => m.clean_sheet).length;
      const totalPoints = (fp ?? []).reduce((s: number, p: any) => s + p.points, 0);
      const avgPoints = fp && fp.length ? totalPoints / fp.length : 0;
      const sortedByGw = [...(fp ?? [])].sort((a: any, b: any) => (b.gameweek?.number ?? 0) - (a.gameweek?.number ?? 0));
      const form = sortedByGw.slice(0, 3).length ? sortedByGw.slice(0, 3).reduce((s: number, p: any) => s + p.points, 0) / sortedByGw.slice(0, 3).length : 0;
      const ownershipPct = managerCount ? ((ownedCount ?? 0) / managerCount) * 100 : 0;
      setStats({ goals, assists, cleanSheets, totalPoints, avgPoints, ownershipPct, form });
    }
    load();
  }, [player.id]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div className="w-full max-w-2xl rounded-t-2xl bg-white p-5 pb-8" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <div>
            <h2 className="font-display text-lg font-bold text-slate-900">{player.name}</h2>
            <p className="text-xs text-slate-500">
              {player.position} · {player.team?.name}
            </p>
          </div>
          <button onClick={onClose} className="rounded-full bg-pitch-surface p-1.5 text-slate-500">
            <X size={16} />
          </button>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <InfoStat label="Price" value={`${player.price.toFixed(1)}M`} />
          <InfoStat label="Next fixture" value={player.nextOpponent ? `${player.nextIsHome ? "H" : "A"} ${teamAbbrev(player.nextOpponent)}` : "—"} />
          <InfoStat label="Fixture difficulty">
            {player.nextFdr ? <FDRBadge rating={player.nextFdr} /> : <span className="text-sm text-slate-400">—</span>}
          </InfoStat>
        </div>

        {stats ? (
          <div className="mt-2 grid grid-cols-3 gap-2">
            <InfoStat label="Total points" value={String(stats.totalPoints)} />
            <InfoStat label="Avg points" value={stats.avgPoints.toFixed(1)} />
            <InfoStat label="Form (last 3)" value={stats.form.toFixed(1)} />
            <InfoStat label="Ownership" value={`${stats.ownershipPct.toFixed(1)}%`} />
            <InfoStat label="Goals" value={String(stats.goals)} />
            <InfoStat label="Assists" value={String(stats.assists)} />
            {(player.position === "GK" || player.position === "DEF") && <InfoStat label="Clean sheets" value={String(stats.cleanSheets)} />}
            <InfoStat label="Scouting bonus">
              <span className={`text-sm font-bold ${stats.ownershipPct < 5 ? "text-emerald-700" : "text-slate-400"}`}>
                {stats.ownershipPct < 5 ? "Eligible" : "Not eligible"}
              </span>
            </InfoStat>
          </div>
        ) : (
          <p className="mt-3 text-xs text-slate-500">Loading stats…</p>
        )}
      </div>
    </div>
  );
}

function InfoStat({ label, value, children }: { label: string; value?: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-pitch-surface border border-pitch-border px-2 py-2 text-center">
      <div className="text-[10px] text-slate-500">{label}</div>
      {children ?? <div className="mt-0.5 font-mono text-sm font-bold text-slate-900">{value}</div>}
    </div>
  );
}
