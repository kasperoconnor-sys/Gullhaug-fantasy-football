"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Gameweek, GameweekStatus } from "@/types";
import { Lock, Unlock, Plus, Trophy } from "lucide-react";

const STATUS_LABEL: Record<GameweekStatus, string> = {
  upcoming: "Upcoming",
  open: "Open",
  in_progress: "In progress",
  locked: "Locked",
  completed: "Completed",
};

export default function AdminGameweeksPage() {
  const supabase = createClient();
  const [gameweeks, setGameweeks] = useState<Gameweek[]>([]);
  const [number, setNumber] = useState("1");
  const [deadline, setDeadline] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  async function load() {
    const { data } = await supabase.from("gameweeks").select("*").order("number");
    setGameweeks((data ?? []) as Gameweek[]);
  }
  useEffect(() => {
    load();
  }, []);

  async function addGameweek() {
    if (!deadline) return;
    await supabase.from("gameweeks").insert({ number: parseInt(number), deadline_at: new Date(deadline).toISOString() });
    setNumber(String(parseInt(number) + 1));
    load();
  }

  async function setStatus(id: string, status: GameweekStatus) {
    await supabase.from("gameweeks").update({ status }).eq("id", id);

    // On completion, roll over free transfers (cap 3) for every manager
    // and auto-generate that round's Team of the Week.
    if (status === "completed") {
      const { data: settings } = await supabase.from("season_settings").select("*").single();
      const { data: teams } = await supabase.from("fantasy_teams").select("id, free_transfers");
      for (const t of teams ?? []) {
        const next = Math.min((t.free_transfers ?? 0) + (settings?.free_transfers_per_gw ?? 1), settings?.max_saved_transfers ?? 3);
        await supabase.from("fantasy_teams").update({ free_transfers: next }).eq("id", t.id);
      }

      setMessage("Gameweek completed, transfers rolled over. Generating Team of the Week…");
      const res = await fetch("/api/team-of-the-week/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameweek_id: id }),
      });
      const body = await res.json();
      setMessage(res.ok ? `Team of the Week generated: ${body.formation}, ${body.total_points} points.` : body.error);
    }
    load();
  }

  return (
    <div>
      <h1 className="font-display text-2xl font-black text-white">Gameweeks</h1>

      <div className="mt-4 flex flex-wrap items-end gap-2 rounded-xl border border-pitch-border bg-pitch-surface p-4">
        <div>
          <label className="text-xs text-slate-500">Gameweek number</label>
          <input type="number" value={number} onChange={(e) => setNumber(e.target.value)} className="mt-1 block w-24 rounded-lg border border-pitch-border bg-pitch px-3 py-2 text-sm text-white outline-none focus:border-violet-500" />
        </div>
        <div>
          <label className="text-xs text-slate-500">Deadline for squad changes</label>
          <input type="datetime-local" value={deadline} onChange={(e) => setDeadline(e.target.value)} className="mt-1 block rounded-lg border border-pitch-border bg-pitch px-3 py-2 text-sm text-white outline-none focus:border-violet-500" />
        </div>
        <button onClick={addGameweek} className="flex items-center gap-1 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-emerald-400">
          <Plus size={14} /> Add gameweek
        </button>
      </div>

      {message && <p className="mt-3 text-sm text-emerald-400">{message}</p>}

      <div className="mt-4 divide-y divide-pitch-border rounded-xl border border-pitch-border bg-pitch-surface">
        {gameweeks.map((gw) => (
          <div key={gw.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
            <div>
              <span className="text-sm font-semibold text-white">Gameweek {gw.number}</span>
              <span className="ml-2 text-xs text-slate-500">{STATUS_LABEL[gw.status]}</span>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setStatus(gw.id, "open")} className="rounded-md bg-slate-800 px-2 py-1 text-xs font-bold text-slate-300 hover:bg-slate-700">Open</button>
              <button onClick={() => setStatus(gw.id, "locked")} className="flex items-center gap-1 rounded-md bg-amber-500/20 px-2 py-1 text-xs font-bold text-amber-400 hover:bg-amber-500/30">
                <Lock size={12} /> Lock
              </button>
              <button onClick={() => setStatus(gw.id, "in_progress")} className="rounded-md bg-slate-800 px-2 py-1 text-xs font-bold text-slate-300 hover:bg-slate-700">
                <Unlock size={12} className="inline" /> In progress
              </button>
              <button onClick={() => setStatus(gw.id, "completed")} className="flex items-center gap-1 rounded-md bg-emerald-500/20 px-2 py-1 text-xs font-bold text-emerald-400 hover:bg-emerald-500/30">
                <Trophy size={12} /> Complete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
