"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Player, PlayerPosition, SQUAD_REQUIREMENTS } from "@/types";
import { validateSquad } from "@/lib/squadRules";
import PlayerCard from "@/components/PlayerCard";
import StatCard from "@/components/StatCard";

const TABS: PlayerPosition[] = ["GK", "DEF", "MID", "FWD"];

export default function SquadPage() {
  const supabase = createClient();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [players, setPlayers] = useState<Player[]>([]);
  const [fantasyTeamId, setFantasyTeamId] = useState<string | null>(null);
  const [budgetCap, setBudgetCap] = useState(100);
  const [gullhaugIds, setGullhaugIds] = useState<{ g1: string; g2: string }>({ g1: "", g2: "" });
  const [selected, setSelected] = useState<string[]>([]);
  const [tab, setTab] = useState<PlayerPosition>("GK");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        router.push("/login");
        return;
      }

      const [{ data: playerRows }, { data: settings }, { data: teamRows }, { data: gullhaugTeams }] = await Promise.all([
        supabase.from("players").select("*, team:teams(*)").eq("is_active", true),
        supabase.from("season_settings").select("*").single(),
        supabase.from("fantasy_teams").select("*").eq("user_id", userData.user.id).maybeSingle(),
        supabase.from("teams").select("id, is_gullhaug, name").eq("is_gullhaug", true),
      ]);

      setPlayers((playerRows ?? []) as Player[]);
      setBudgetCap(settings?.starting_budget ?? 100);

      const g1 = gullhaugTeams?.find((t) => t.name.includes("1"))?.id ?? gullhaugTeams?.[0]?.id ?? "";
      const g2 = gullhaugTeams?.find((t) => t.name.includes("2"))?.id ?? gullhaugTeams?.[1]?.id ?? "";
      setGullhaugIds({ g1, g2 });

      if (teamRows) {
        setFantasyTeamId(teamRows.id);
        const { data: squadRows } = await supabase
          .from("fantasy_squad_players")
          .select("player_id")
          .eq("fantasy_team_id", teamRows.id);
        setSelected((squadRows ?? []).map((r) => r.player_id));
      }

      setLoading(false);
    }
    load();
  }, [supabase, router]);

  const selectedPlayers = useMemo(() => players.filter((p) => selected.includes(p.id)), [players, selected]);
  const spent = selectedPlayers.reduce((s, p) => s + p.price, 0);
  const remaining = Math.round((budgetCap - spent) * 10) / 10;
  const countByPos = (pos: PlayerPosition) => selectedPlayers.filter((p) => p.position === pos).length;
  const countByTeam = (teamId: string) => selectedPlayers.filter((p) => p.team_id === teamId).length;

  const validation = validateSquad(selectedPlayers, budgetCap, {
    gullhaug1Id: gullhaugIds.g1,
    gullhaug2Id: gullhaugIds.g2,
  });

  function toggle(player: Player) {
    const inSquad = selected.includes(player.id);
    if (inSquad) {
      setSelected(selected.filter((id) => id !== player.id));
      return;
    }
    if (selected.length >= 15) return;
    if (countByPos(player.position) >= SQUAD_REQUIREMENTS[player.position]) return;
    if (countByTeam(player.team_id) >= 4) return;
    if (player.price > remaining) return;
    setSelected([...selected, player.id]);
  }

  async function saveSquad() {
    if (!fantasyTeamId || !validation.valid) return;
    setSaving(true);
    setMessage(null);
    const res = await fetch("/api/squad", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fantasy_team_id: fantasyTeamId, player_ids: selected }),
    });
    const body = await res.json();
    setSaving(false);
    if (!res.ok) {
      setMessage(body.error ?? "Kunne ikke lagre laget.");
      return;
    }
    setMessage("Laget er lagret!");
    router.push("/lineup");
  }

  if (loading) return <div className="mx-auto max-w-2xl px-4 py-10 text-slate-400">Laster…</div>;

  const posPlayers = players.filter((p) => p.position === tab);

  return (
    <div className="mx-auto max-w-2xl px-4 pb-32 pt-6">
      <h1 className="font-display text-2xl font-black text-white">Bygg laget ditt</h1>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <StatCard label="Budsjett igjen" value={`${remaining.toFixed(1)}M`} accent="violet" />
        <StatCard label="Spillere valgt" value={`${selected.length} / 15`} accent="emerald" />
      </div>

      <div className="mt-4 grid grid-cols-4 gap-2">
        {TABS.map((p) => (
          <button
            key={p}
            onClick={() => setTab(p)}
            className={`rounded-xl border py-2 text-sm font-bold transition ${
              tab === p ? "border-violet-500 bg-violet-600 text-white" : "border-pitch-border bg-pitch-surface text-slate-400"
            }`}
          >
            {p} <span className="font-normal opacity-70">{countByPos(p)}/{SQUAD_REQUIREMENTS[p]}</span>
          </button>
        ))}
      </div>

      <p className="mt-3 px-1 text-xs text-slate-500">
        Min. 2 fra Gullhaug 1 · Min. 2 fra Gullhaug 2 · Maks 4 spillere per lag
      </p>

      <div className="mt-3 space-y-2">
        {posPlayers.map((player) => {
          const inSquad = selected.includes(player.id);
          const disabled =
            !inSquad &&
            (selected.length >= 15 ||
              countByPos(player.position) >= SQUAD_REQUIREMENTS[player.position] ||
              countByTeam(player.team_id) >= 4 ||
              player.price > remaining);
          return <PlayerCard key={player.id} player={player} selected={inSquad} disabled={disabled} onClick={() => toggle(player)} />;
        })}
      </div>

      <div className="fixed bottom-0 left-0 right-0 border-t border-pitch-border bg-pitch/95 backdrop-blur">
        <div className="mx-auto max-w-2xl px-4 py-3">
          {!validation.valid && selected.length > 0 && (
            <p className="mb-2 text-center text-xs text-amber-400">{validation.errors[0]}</p>
          )}
          {message && <p className="mb-2 text-center text-xs text-emerald-400">{message}</p>}
          <button
            onClick={saveSquad}
            disabled={!validation.valid || saving}
            className="w-full rounded-xl bg-emerald-500 py-3 font-bold text-slate-950 hover:bg-emerald-400 disabled:bg-slate-800 disabled:text-slate-500"
          >
            {saving ? "Lagrer…" : "Lagre laget"}
          </button>
        </div>
      </div>
    </div>
  );
}
