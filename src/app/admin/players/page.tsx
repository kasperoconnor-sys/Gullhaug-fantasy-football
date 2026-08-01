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
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

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
    setError(null);
    if (!name.trim()) {
      setError("Player name is required.");
      return;
    }
    if (!teamId) {
      setError("Add a team first before adding players.");
      return;
    }
    const priceNum = parseFloat(price);
    if (isNaN(priceNum) || priceNum <= 0) {
      setError("Price must be a number greater than 0.");
      return;
    }
    setSaving(true);
    const { error: insertError } = await supabase.from("players").insert({ name: name.trim(), team_id: teamId, position, price: priceNum });
    setSaving(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    setName("");
    load();
  }

  async function removePlayer(id: string) {
    const { error: updateError } = await supabase.from("players").update({ is_active: false }).eq("id", id);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    load();
  }

  return (
    <div>
      <h1 className="font-display text-2xl font-black text-slate-900">Players</h1>

      <div className="mt-4 flex flex-wrap items-end gap-2 rounded-xl border border-pitch-border bg-pitch-surface p-4">
        <div>
          <label className="text-xs text-slate-500">Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 block rounded-lg border border-pitch-border bg-pitch px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-900" />
        </div>
        <div>
          <label className="text-xs text-slate-500">Team</label>
          <select value={teamId} onChange={(e) => setTeamId(e.target.value)} className="mt-1 block rounded-lg border border-pitch-border bg-pitch px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-900">
            {teams.length === 0 && <option value="">No teams yet</option>}
            {teams.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-slate-500">Position</label>
          <select value={position} onChange={(e) => setPosition(e.target.value as PlayerPosition)} className="mt-1 block rounded-lg border border-pitch-border bg-pitch px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-900">
            {["GK", "DEF", "MID", "FWD"].map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-slate-500">Price (M)</label>
          <input type="number" step="0.5" value={price} onChange={(e) => setPrice(e.target.value)} className="mt-1 block w-24 rounded-lg border border-pitch-border bg-pitch px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-900" />
        </div>
        <button onClick={addPlayer} disabled={saving} className="flex items-center gap-1 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-emerald-400 disabled:opacity-50">
          <Plus size={14} /> {saving ? "Adding…" : "Add"}
        </button>
        {error && <p className="w-full text-sm text-rose-600">{error}</p>}
      </div>

      <div className="mt-4 divide-y divide-pitch-border rounded-xl border border-pitch-border bg-pitch-surface">
        {players.map((p) => (
          <div key={p.id} className="flex items-center justify-between px-4 py-2.5">
            <span className="text-sm text-slate-900">
              {p.name} — {p.position} — {p.team?.name} — {p.price.toFixed(1)}M
            </span>
            <button onClick={() => removePlayer(p.id)} className="text-slate-500 hover:text-rose-600">
              <Trash2 size={16} />
            </button>
          </div>
        ))}
        {players.length === 0 && <p className="px-4 py-3 text-sm text-slate-500">No players yet.</p>}
      </div>
    </div>
  );
}
