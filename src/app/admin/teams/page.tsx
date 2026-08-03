"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Team } from "@/types";
import { Plus, Trash2 } from "lucide-react";

export default function AdminTeamsPage() {
  const supabase = createClient();
  const [teams, setTeams] = useState<Team[]>([]);
  const [name, setName] = useState("");
  const [shortName, setShortName] = useState("");
  const [league, setLeague] = useState("");
  const [color, setColor] = useState("#334155");
  const [isGullhaug, setIsGullhaug] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    const { data } = await supabase.from("teams").select("*").order("name");
    setTeams((data ?? []) as Team[]);
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, []);

  async function addTeam() {
    setError(null);
    if (!name.trim() || !shortName.trim()) {
      setError("Name and Short name are both required.");
      return;
    }
    setSaving(true);
    const { error: insertError } = await supabase
      .from("teams")
      .insert({ name: name.trim(), short_name: shortName.trim(), is_gullhaug: isGullhaug, league: league.trim() || null, color });
    setSaving(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    setName("");
    setShortName("");
    setLeague("");
    setColor("#334155");
    setIsGullhaug(false);
    load();
  }

  async function removeTeam(id: string) {
    const { error: deleteError } = await supabase.from("teams").delete().eq("id", id);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }
    load();
  }

  async function updateTeamColor(id: string, newColor: string) {
    setTeams((prev) => prev.map((t: any) => (t.id === id ? { ...t, color: newColor } : t)));
    const { error: updateError } = await supabase.from("teams").update({ color: newColor }).eq("id", id);
    if (updateError) setError(updateError.message);
  }

  return (
    <div>
      <h1 className="font-display text-2xl font-black text-slate-900">Teams</h1>

      <div className="mt-4 flex flex-wrap items-end gap-2 rounded-xl border border-pitch-border bg-pitch-surface p-4">
        <Field label="Name" value={name} onChange={setName} />
        <Field label="Short name" value={shortName} onChange={setShortName} />
        <Field label="League / Division" value={league} onChange={setLeague} placeholder="e.g. Vestfold 1. div" />
        <div>
          <label className="text-xs text-slate-500">Team colour</label>
          <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="mt-1 block h-9 w-14 rounded-lg border border-pitch-border bg-pitch p-1" />
        </div>
        <label className="flex items-center gap-2 pb-2 text-sm text-slate-700">
          <input type="checkbox" checked={isGullhaug} onChange={(e) => setIsGullhaug(e.target.checked)} />
          Gullhaug team
        </label>
        <button onClick={addTeam} disabled={saving} className="flex items-center gap-1 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-emerald-400 disabled:opacity-50">
          <Plus size={14} /> {saving ? "Adding…" : "Add"}
        </button>
        {error && <p className="w-full text-sm text-rose-600">{error}</p>}
      </div>

      <p className="mt-4 text-xs text-slate-500">Tap a colour swatch below to change any existing team's colour instantly — no need to re-add anything.</p>

      {!loading && (
        <div className="mt-2 divide-y divide-pitch-border rounded-xl border border-pitch-border bg-pitch-surface">
          {teams.map((t: any) => (
            <div key={t.id} className="flex items-center justify-between px-4 py-2.5">
              <span className="flex items-center gap-2 text-sm text-slate-900">
                <input
                  type="color"
                  value={t.color || "#94a3b8"}
                  onChange={(e) => updateTeamColor(t.id, e.target.value)}
                  className="h-6 w-8 cursor-pointer rounded border border-pitch-border p-0"
                  title="Change team colour"
                />
                {t.name} ({t.short_name}) {t.is_gullhaug && <span className="text-emerald-600">★ Gullhaug</span>}
                {t.league && <span className="ml-2 text-xs text-slate-500">— {t.league}</span>}
              </span>
              <button onClick={() => removeTeam(t.id)} className="text-slate-500 hover:text-rose-600">
                <Trash2 size={16} />
              </button>
            </div>
          ))}
          {teams.length === 0 && <p className="px-4 py-3 text-sm text-slate-500">No teams yet.</p>}
        </div>
      )}
    </div>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label className="text-xs text-slate-500">{label}</label>
      <input
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 block rounded-lg border border-pitch-border bg-pitch px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-900"
      />
    </div>
  );
}
