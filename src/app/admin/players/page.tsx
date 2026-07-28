"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Player, PlayerPosition, Team } from "@/types";
import { Plus, Trash2 } from "lucide-react";

export default function AdminPlayersPage() {
  const supabase = createClient();
  const [players, setPlayers] = useState<Player[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [name, setName] = useState("");
  const [teamId, setTeamId] = useState("");
  const [position, setPosition] = useState<PlayerPosition>("GK");
  const [price, setPrice] = useState("5.0");

  async function load() {
    const [{ data: p }, { data: t }] = await Promise.all([
      supabase.from("players").select("*, team:teams(*)").order("name"),
      supabase.from("teams").select("*").order("name"),
    ]);
    setPlayers((p ?? []) as Player[]);
    setTeams((t ?? []) as Team[]);
    if (t && t.length > 0 && !teamId) setTeamId(t[0].id);
  }
  useEffect(() => {
    load();
  }, []);

  async function addPlayer() {
    if (!name.trim() || !teamId) return;
    await supabase.from("players").insert({ name, team_id: teamId, position, price: parseFloat(price) });
    setName("");
    load();
  }

  async function removePlayer(id: string) {
    await supabase.from("players").update({ is_active: false }).eq("id", id);
    load();
  }

  return (
    <div>
      <h1 className="font-display text-2xl font-black text-white">Spillere</h1>

      <div className="mt-4 flex flex-wrap items-end gap-2 rounded-xl border border-pitch-border bg-pitch-surface p-4">
        <div>
          <label className="text-xs text-slate-500">Navn</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 block rounded-lg border border-pitch-border bg-pitch px-3 py-2 text-sm text-white outline-none focus:border-violet-500" />
        </div>
        <div>
          <label className="text-xs text-slate-500">Lag</label>
          <select value={teamId} onChange={(e) => setTeamId(e.target.value)} className="mt-1 block rounded-lg border border-pitch-border bg-pitch px-3 py-2 text-sm text-white outline-none focus:border-violet-500">
            {teams.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-slate-500">Posisjon</label>
          <select value={position} onChange={(e) => setPosition(e.target.value as PlayerPosition)} className="mt-1 block rounded-lg border border-pitch-border bg-pitch px-3 py-2 text-sm text-white outline-none focus:border-violet-500">
            {["GK", "DEF", "MID", "FWD"].map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-slate-500">Pris (M)</label>
          <input type="number" step="0.5" value={price} onChange={(e) => setPrice(e.target.value)} className="mt-1 block w-24 rounded-lg border border-pitch-border bg-pitch px-3 py-2 text-sm text-white outline-none focus:border-violet-500" />
        </div>
        <button onClick={addPlayer} className="flex items-center gap-1 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-emerald-400">
          <Plus size={14} /> Legg til
        </button>
      </div>

      <div className="mt-4 divide-y divide-pitch-border rounded-xl border border-pitch-border bg-pitch-surface">
        {players.map((p) => (
          <div key={p.id} className="flex items-center justify-between px-4 py-2.5">
            <span className="text-sm text-white">
              {p.name} — {p.position} — {p.team?.name} — {p.price.toFixed(1)}M
            </span>
            <button onClick={() => removePlayer(p.id)} className="text-slate-500 hover:text-rose-400">
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
