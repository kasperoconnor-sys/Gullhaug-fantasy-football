"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { FORMATIONS, Fixture, Player } from "@/types";
import { isValidFormationCounts } from "@/lib/scoring";
import PlayerCard from "@/components/PlayerCard";

interface SquadPlayer extends Player {
  fixture?: Fixture;
}

export default function LineupPage() {
  const supabase = createClient();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [fantasyTeamId, setFantasyTeamId] = useState<string | null>(null);
  const [gameweekId, setGameweekId] = useState<string | null>(null);
  const [squad, setSquad] = useState<SquadPlayer[]>([]);
  const [formation, setFormation] = useState("4-4-2");
  const [starters, setStarters] = useState<string[]>([]);
  const [captain, setCaptain] = useState<string | null>(null);
  const [vice, setVice] = useState<string | null>(null);
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

      const { data: gw } = await supabase
        .from("gameweeks")
        .select("*")
        .in("status", ["upcoming", "open"])
        .order("number", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (gw) setGameweekId(gw.id);

      const { data: squadRows } = await supabase
        .from("fantasy_squad_players")
        .select("player:players(*, team:teams(*))")
        .eq("fantasy_team_id", team.id);
      setSquad((squadRows ?? []).map((r: any) => r.player));

      if (gw) {
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
        }
      }

      setLoading(false);
    }
    load();
  }, [supabase, router]);

  const need = FORMATIONS[formation];
  const startCount = (pos: string) => squad.filter((p) => starters.includes(p.id) && p.position === pos).length;
  const bench = squad.filter((p) => !starters.includes(p.id));

  const lineupValid = isValidFormationCounts(
    { GK: startCount("GK"), DEF: startCount("DEF"), MID: startCount("MID"), FWD: startCount("FWD") },
    need
  );

  function toggleStarter(player: SquadPlayer) {
    const isIn = starters.includes(player.id);
    if (isIn) {
      setStarters(starters.filter((id) => id !== player.id));
      if (captain === player.id) setCaptain(null);
      if (vice === player.id) setVice(null);
      return;
    }
    if (starters.length >= 11) return;
    const cap = player.position === "GK" ? 1 : need[player.position as "DEF" | "MID" | "FWD"];
    if (startCount(player.position) >= cap) return;
    setStarters([...starters, player.id]);
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

  if (loading) return <div className="mx-auto max-w-2xl px-4 py-10 text-slate-400">Loading…</div>;
  if (!gameweekId) return <div className="mx-auto max-w-2xl px-4 py-10 text-slate-400">No open gameweek right now.</div>;

  return (
    <div className="mx-auto max-w-2xl px-4 pb-32 pt-6">
      <h1 className="font-display text-2xl font-black text-white">Lineup</h1>

      <div className="mt-4 flex gap-2 overflow-x-auto">
        {Object.keys(FORMATIONS).map((f) => (
          <button
            key={f}
            onClick={() => {
              setFormation(f);
              setStarters([]);
              setCaptain(null);
              setVice(null);
            }}
            className={`shrink-0 rounded-full border px-4 py-2 text-sm font-bold ${
              formation === f ? "border-emerald-400 bg-emerald-500 text-slate-950" : "border-pitch-border bg-pitch-surface text-slate-400"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {(["GK", "DEF", "MID", "FWD"] as const).map((pos) => (
        <div key={pos} className="mt-5">
          <div className="mb-2 text-xs font-bold text-slate-500">
            {pos} — {startCount(pos)}/{pos === "GK" ? 1 : need[pos]} in starting XI
          </div>
          <div className="space-y-2">
            {squad
              .filter((p) => p.position === pos)
              .map((player) => {
                const isStarter = starters.includes(player.id);
                return (
                  <PlayerCard
                    key={player.id}
                    player={player}
                    selected={isStarter}
                    onClick={() => toggleStarter(player)}
                    rightSlot={
                      isStarter ? (
                        <div className="flex gap-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setCaptain(player.id);
                              if (vice === player.id) setVice(null);
                            }}
                            className={`rounded-md px-2 py-1 text-[10px] font-bold ${
                              captain === player.id ? "bg-amber-500 text-slate-950" : "bg-slate-800 text-slate-400"
                            }`}
                          >
                            C
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setVice(player.id);
                              if (captain === player.id) setCaptain(null);
                            }}
                            className={`rounded-md px-2 py-1 text-[10px] font-bold ${
                              vice === player.id ? "bg-sky-500 text-slate-950" : "bg-slate-800 text-slate-400"
                            }`}
                          >
                            VC
                          </button>
                        </div>
                      ) : null
                    }
                  />
                );
              })}
          </div>
        </div>
      ))}

      <div className="mt-5">
        <div className="mb-2 text-xs font-bold text-slate-500">Bench ({bench.length})</div>
        <div className="flex flex-wrap gap-2">
          {bench.map((p) => (
            <span key={p.id} className="rounded-lg border border-pitch-border bg-pitch-surface px-2 py-1 text-xs text-slate-400">
              {p.name}
            </span>
          ))}
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 border-t border-pitch-border bg-pitch/95 backdrop-blur">
        <div className="mx-auto max-w-2xl px-4 py-3">
          {message && <p className="mb-2 text-center text-xs text-emerald-400">{message}</p>}
          <button
            onClick={save}
            disabled={!lineupValid || !captain || !vice || saving}
            className="w-full rounded-xl bg-violet-600 py-3 font-bold text-white hover:bg-violet-500 disabled:bg-slate-800 disabled:text-slate-500"
          >
            {saving ? "Saving…" : "Save lineup"}
          </button>
        </div>
      </div>
    </div>
  );
}
