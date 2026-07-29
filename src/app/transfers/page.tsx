"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Player } from "@/types";
import PlayerCard from "@/components/PlayerCard";
import StatCard from "@/components/StatCard";
import { ArrowRightLeft } from "lucide-react";

export default function TransfersPage() {
  const supabase = createClient();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [fantasyTeamId, setFantasyTeamId] = useState<string | null>(null);
  const [gameweekId, setGameweekId] = useState<string | null>(null);
  const [freeTransfers, setFreeTransfers] = useState(1);
  const [budgetRemaining, setBudgetRemaining] = useState(0);
  const [squad, setSquad] = useState<Player[]>([]);
  const [allPlayers, setAllPlayers] = useState<Player[]>([]);
  const [playerOut, setPlayerOut] = useState<Player | null>(null);
  const [playerIn, setPlayerIn] = useState<Player | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

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
      setFreeTransfers(team.free_transfers);
      setBudgetRemaining(team.budget_remaining);

      const { data: gw } = await supabase
        .from("gameweeks")
        .select("*")
        .in("status", ["upcoming", "open"])
        .order("number")
        .limit(1)
        .maybeSingle();
      if (gw) setGameweekId(gw.id);

      const { data: squadRows } = await supabase
        .from("fantasy_squad_players")
        .select("player:players(*, team:teams(*))")
        .eq("fantasy_team_id", team.id);
      setSquad((squadRows ?? []).map((r: any) => r.player));

      const { data: pool } = await supabase.from("players").select("*, team:teams(*)").eq("is_active", true);
      setAllPlayers((pool ?? []) as Player[]);

      setLoading(false);
    }
    load();
  }, [supabase, router]);

  const candidatesIn = playerOut ? allPlayers.filter((p) => p.position === playerOut.position && !squad.some((s) => s.id === p.id)) : [];
  const budgetAfterSwap = playerOut && playerIn ? budgetRemaining + playerOut.price - playerIn.price : budgetRemaining;
  const willBeFree = freeTransfers > 0;
  const pointCost = willBeFree ? 0 : 3;

  async function confirmTransfer() {
    if (!fantasyTeamId || !gameweekId || !playerOut || !playerIn) return;
    setSaving(true);
    setMessage(null);
    const res = await fetch("/api/transfers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fantasy_team_id: fantasyTeamId,
        gameweek_id: gameweekId,
        player_out_id: playerOut.id,
        player_in_id: playerIn.id,
      }),
    });
    const body = await res.json();
    setSaving(false);
    if (!res.ok) {
      setMessage(body.error ?? "Couldn't complete the transfer.");
      return;
    }
    setSquad(squad.map((p) => (p.id === playerOut.id ? playerIn : p)));
    setBudgetRemaining(body.budget_remaining);
    setFreeTransfers(body.free_transfers);
    setPlayerOut(null);
    setPlayerIn(null);
    setMessage("Transfer complete!");
  }

  if (loading) return <div className="mx-auto max-w-2xl px-4 py-10 text-slate-400">Loading…</div>;

  return (
    <div className="mx-auto max-w-2xl px-4 pb-24 pt-6">
      <h1 className="font-display text-2xl font-black text-white">Transfers</h1>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <StatCard label="Free transfers" value={freeTransfers} accent="emerald" />
        <StatCard label="Budget remaining" value={`${budgetRemaining.toFixed(1)}M`} accent="violet" />
      </div>
      <p className="mt-2 text-xs text-slate-500">
        Unused transfers roll over (max 3 saved). Extra transfers beyond your free ones cost 3 points each.
      </p>

      <h2 className="mt-6 text-sm font-bold text-slate-400">1. Choose player out</h2>
      <div className="mt-2 space-y-2">
        {squad.map((p) => (
          <PlayerCard key={p.id} player={p} selected={playerOut?.id === p.id} onClick={() => { setPlayerOut(p); setPlayerIn(null); }} />
        ))}
      </div>

      {playerOut && (
        <>
          <h2 className="mt-6 text-sm font-bold text-slate-400">2. Choose player in ({playerOut.position})</h2>
          <div className="mt-2 space-y-2">
            {candidatesIn.map((p) => {
              const wouldExceedBudget = budgetRemaining + playerOut.price - p.price < 0;
              return (
                <PlayerCard
                  key={p.id}
                  player={p}
                  selected={playerIn?.id === p.id}
                  disabled={wouldExceedBudget}
                  onClick={() => setPlayerIn(p)}
                />
              );
            })}
          </div>
        </>
      )}

      {playerOut && playerIn && (
        <div className="mt-6 rounded-xl border border-pitch-border bg-pitch-surface p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <ArrowRightLeft size={16} className="text-violet-400" />
            {playerOut.name} → {playerIn.name}
          </div>
          <div className="mt-2 text-sm text-slate-400">Budget after swap: {budgetAfterSwap.toFixed(1)}M</div>
          <div className="text-sm text-slate-400">
            Cost: {willBeFree ? "Free transfer" : `-${pointCost} points (no free transfers left)`}
          </div>
          {message && <p className="mt-2 text-xs text-emerald-400">{message}</p>}
          <button
            onClick={confirmTransfer}
            disabled={saving || budgetAfterSwap < 0}
            className="mt-3 w-full rounded-xl bg-emerald-500 py-2.5 font-bold text-slate-950 hover:bg-emerald-400 disabled:opacity-50"
          >
            {saving ? "Confirming…" : "Confirm transfer"}
          </button>
        </div>
      )}
    </div>
  );
}
