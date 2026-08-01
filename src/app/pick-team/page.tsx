"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { FORMATIONS, Player } from "@/types";
import { isValidFormationCounts } from "@/lib/scoring";
import FDRBadge from "@/components/FDRBadge";
import { Zap, ArrowLeftRight } from "lucide-react";

interface SquadPlayer extends Player {
  nextFdr?: number;
  nextOpponent?: string;
}

export default function PickTeamPage() {
  const supabase = createClient();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [teamMeta, setTeamMeta] = useState<{ team_name: string; budget_remaining: number; free_transfers: number } | null>(null);
  const [chipsRemaining, setChipsRemaining] = useState(4);
  const [fantasyTeamId, setFantasyTeamId] = useState<string | null>(null);
  const [gameweekId, setGameweekId] = useState<string | null>(null);
  const [squad, setSquad] = useState<SquadPlayer[]>([]);
  const [formation, setFormation] = useState("4-4-2");
  const [starters, setStarters] = useState<string[]>([]);
  const [captain, setCaptain] = useState<string | null>(null);
  const [vice, setVice] = useState<string | null>(null);
  const [selectedForSwap, setSelectedForSwap] = useState<string | null>(null);
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

      const { data: usedChips } = await supabase.from("chip_usages").select("id").eq("fantasy_team_id", team.id);
      setChipsRemaining(4 - (usedChips?.length ?? 0));

      const { data: squadRows } = await supabase
        .from("fantasy_squad_players")
        .select("player:players(*, team:teams(*))")
        .eq("fantasy_team_id", team.id);
      if (!squadRows || squadRows.length < 15) {
        router.push("/squad");
        return;
      }
      let squadPlayers: SquadPlayer[] = squadRows.map((r: any) => r.player);

      // Enrich with each player's next fixture FDR.
      const { data: upcomingFixtures } = await supabase
        .from("fixtures")
        .select("*, home_team:teams!fixtures_home_team_id_fkey(*), away_team:teams!fixtures_away_team_id_fkey(*)")
        .eq("is_final", false)
        .order("kickoff_at", { ascending: true });
      squadPlayers = squadPlayers.map((p) => {
        const next = (upcomingFixtures ?? []).find((f: any) => f.home_team_id === p.team_id || f.away_team_id === p.team_id);
        if (!next) return p;
        const isHome = next.home_team_id === p.team_id;
        return { ...p, nextFdr: isHome ? next.home_fdr : next.away_fdr, nextOpponent: isHome ? next.away_team?.name : next.home_team?.name };
      });
      setSquad(squadPlayers);

      const { data: gw } = await supabase
        .from("gameweeks")
        .select("*")
        .in("status", ["upcoming", "open"])
        .order("number", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (gw) {
        setGameweekId(gw.id);
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
          // Default: first 11 that fit the default formation, GK first.
          const need = FORMATIONS[formation];
          const gk = squadPlayers.filter((p) => p.position === "GK").slice(0, 1);
          const def = squadPlayers.filter((p) => p.position === "DEF").slice(0, need.DEF);
          const mid = squadPlayers.filter((p) => p.position === "MID").slice(0, need.MID);
          const fwd = squadPlayers.filter((p) => p.position === "FWD").slice(0, need.FWD);
          setStarters([...gk, ...def, ...mid, ...fwd].map((p) => p.id));
        }
      }

      setLoading(false);
    }
    load();
  }, [supabase, router]);

  const need = FORMATIONS[formation];
  const byPos = (pos: string) => squad.filter((p) => p.position === pos);
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

    // Only swap starter <-> bench of the same position (keeps formation valid automatically).
    const selectedIsStarter = starters.includes(selectedForSwap);
    if (selectedIsStarter !== isStarter && selectedPlayer.position === player.position) {
      setStarters((prev) => {
        const withoutBoth = prev.filter((id) => id !== selectedForSwap && id !== player.id);
        const incoming = selectedIsStarter ? player.id : selectedForSwap;
        return [...withoutBoth, incoming];
      });
      // If the player benched was captain/vice, clear that role — it must be reassigned among starters.
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
    // top up if the new formation needs more of a position than currently starting
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

  if (loading) return <div className="mx-auto max-w-2xl px-4 py-10 text-slate-500">Loading…</div>;
  if (!gameweekId) return <div className="mx-auto max-w-2xl px-4 py-10 text-slate-500">No open gameweek right now.</div>;

  return (
    <div className="mx-auto max-w-2xl px-4 pb-32 pt-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-black text-slate-900">{teamMeta?.team_name}</h1>
        <Link href="/chips" className="flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-3 py-1.5 text-xs font-bold text-amber-700">
          <Zap size={12} /> {chipsRemaining} chips left
        </Link>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <MiniStat label="Team value" value={`${squad.reduce((s, p) => s + p.price, 0).toFixed(1)}M`} />
        <MiniStat label="Bank" value={`${(teamMeta?.budget_remaining ?? 0).toFixed(1)}M`} />
        <MiniStat label="Free transfers" value={String(teamMeta?.free_transfers ?? 0)} />
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

      {!lineupValid && <p className="mt-2 text-center text-xs text-amber-400">Formation needs {need.DEF} DEF / {need.MID} MID / {need.FWD} FWD starting.</p>}

      {/* Bench */}
      <div className="mt-5">
        <div className="mb-2 text-xs font-bold text-slate-500">Bench</div>
        <div className="flex flex-wrap gap-2">
          {bench.map((p) => (
            <PitchToken key={p.id} player={p} bench selected={selectedForSwap === p.id} onTap={() => tapPlayer(p)} />
          ))}
        </div>
      </div>

      <div className="fixed bottom-16 left-0 right-0 border-t border-pitch-border bg-pitch/95 backdrop-blur md:bottom-0">
        <div className="mx-auto max-w-2xl px-4 py-3">
          {!captain && lineupValid && <p className="mb-2 text-center text-xs text-amber-400">Tap C on a starter to set Captain, VC for Vice Captain.</p>}
          {message && <p className="mb-2 text-center text-xs text-emerald-400">{message}</p>}
          <button
            onClick={save}
            disabled={!lineupValid || !captain || !vice || saving}
            className="w-full rounded-xl bg-slate-900 py-3 font-bold text-white hover:bg-slate-800 disabled:bg-slate-800 disabled:text-slate-500"
          >
            {saving ? "Saving…" : "Save lineup"}
          </button>
        </div>
      </div>
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
  onSetCaptain,
  onSetVice,
}: {
  player: SquadPlayer;
  isCaptain?: boolean;
  isVice?: boolean;
  selected?: boolean;
  bench?: boolean;
  onTap: () => void;
  onSetCaptain?: () => void;
  onSetVice?: () => void;
}) {
  return (
    <div
      onClick={onTap}
      className={`flex w-[92px] flex-col items-center rounded-xl border px-1.5 py-2 text-center cursor-pointer transition ${
        selected
          ? "border-slate-400 bg-slate-200 ring-2 ring-slate-400"
          : bench
          ? "border-pitch-border bg-pitch-surface/80"
          : "border-white/20 bg-black/30 backdrop-blur"
      }`}
    >
      <div className="truncate w-full text-[11px] font-bold text-white">{player.name.split(" ").slice(-1)[0]}</div>
      <div className="mt-0.5 flex items-center gap-1">
        {player.nextFdr && <FDRBadge rating={player.nextFdr} />}
      </div>
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
