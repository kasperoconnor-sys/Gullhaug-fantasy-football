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
  const [isGullhaug, setIsGullhaug] = useState(false);
  const [loading, setLoading] = useState(true);

  async function load() {
    const { data } = await supabase.from("teams").select("*").order("name");
    setTeams((data ?? []) as Team[]);
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, []);

  async function addTeam() {
    if (!name.trim() || !shortName.trim()) return;
    await supabase.from("teams").insert({ name, short_name: shortName, is_gullhaug: isGullhaug });
    setName("");
    setShortName("");
    setIsGullhaug(false);
    load();
  }

  async function removeTeam(id: string) {
    await supabase.from("teams").delete().eq("id", id);
    load();
  }

  return (
    <div>
      <h1 className="font-display text-2xl font-black text-white">Lag</h1>

      <div className="mt-4 flex flex-wrap items-end gap-2 rounded-xl border border-pitch-border bg-pitch-surface p-4">
        <Field label="Navn" value={name} onChange={setName} />
        <Field label="Kortnavn" value={shortName} onChange={setShortName} />
        <label className="flex items-center gap-2 pb-2 text-sm text-slate-300">
          <input type="checkbox" checked={isGullhaug} onChange={(e) => setIsGullhaug(e.target.checked)} />
          Gullhaug-lag
        </label>
        <button onClick={addTeam} className="flex items-center gap-1 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-emerald-400">
          <Plus size={14} /> Legg til
        </button>
      </div>

      {!loading && (
        <div className="mt-4 divide-y divide-pitch-border rounded-xl border border-pitch-border bg-pitch-surface">
          {teams.map((t) => (
            <div key={t.id} className="flex items-center justify-between px-4 py-2.5">
              <span className="text-sm text-white">
                {t.name} ({t.short_name}) {t.is_gullhaug && <span className="text-emerald-400">★ Gullhaug</span>}
              </span>
              <button onClick={() => removeTeam(t.id)} className="text-slate-500 hover:text-rose-400">
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="text-xs text-slate-500">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 block rounded-lg border border-pitch-border bg-pitch px-3 py-2 text-sm text-white outline-none focus:border-violet-500"
      />
    </div>
  );
}
