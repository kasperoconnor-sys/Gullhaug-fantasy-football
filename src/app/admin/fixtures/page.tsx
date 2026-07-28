"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Team, Gameweek } from "@/types";
import FDRBadge from "@/components/FDRBadge";
import { Plus } from "lucide-react";

export default function AdminFixturesPage() {
  const supabase = createClient();
  const [teams, setTeams] = useState<Team[]>([]);
  const [gameweeks, setGameweeks] = useState<Gameweek[]>([]);
  const [fixtures, setFixtures] = useState<any[]>([]);
  const [gwId, setGwId] = useState("");
  const [homeId, setHomeId] = useState("");
  const [awayId, setAwayId] = useState("");
  const [kickoff, setKickoff] = useState("");
  const [homeFdr, setHomeFdr] = useState(3);
  const [awayFdr, setAwayFdr] = useState(3);

  async function load() {
    const [{ data: t }, { data: gw }, { data: f }] = await Promise.all([
      supabase.from("teams").select("*").order("name"),
      supabase.from("gameweeks").select("*").order("number"),
      supabase
        .from("fixtures")
        .select("*, home_team:teams!fixtures_home_team_id_fkey(*), away_team:teams!fixtures_away_team_id_fkey(*), gameweek:gameweeks(*)")
        .order("kickoff_at"),
    ]);
    setTeams((t ?? []) as Team[]);
    setGameweeks((gw ?? []) as Gameweek[]);
    setFixtures(f ?? []);
    if (gw && gw.length > 0 && !gwId) setGwId(gw[0].id);
    if (t && t.length > 1) {
      setHomeId(t[0].id);
      setAwayId(t[1].id);
    }
  }
  useEffect(() => {
    load();
  }, []);

  async function addFixture() {
    if (!gwId || !homeId || !awayId || !kickoff || homeId === awayId) return;
    await supabase.from("fixtures").insert({
      gameweek_id: gwId,
      home_team_id: homeId,
      away_team_id: awayId,
      kickoff_at: new Date(kickoff).toISOString(),
      home_fdr: homeFdr,
      away_fdr: awayFdr,
    });
    load();
  }

  return (
    <div>
      <h1 className="font-display text-2xl font-black text-white">Kamper</h1>

      <div className="mt-4 grid gap-2 rounded-xl border border-pitch-border bg-pitch-surface p-4 sm:grid-cols-3">
        <Select label="Runde" value={gwId} onChange={setGwId} options={gameweeks.map((g) => ({ value: g.id, label: `Runde ${g.number}` }))} />
        <Select label="Hjemmelag" value={homeId} onChange={setHomeId} options={teams.map((t) => ({ value: t.id, label: t.name }))} />
        <Select label="Bortelag" value={awayId} onChange={setAwayId} options={teams.map((t) => ({ value: t.id, label: t.name }))} />
        <div>
          <label className="text-xs text-slate-500">Kampstart</label>
          <input type="datetime-local" value={kickoff} onChange={(e) => setKickoff(e.target.value)} className="mt-1 block w-full rounded-lg border border-pitch-border bg-pitch px-3 py-2 text-sm text-white outline-none focus:border-violet-500" />
        </div>
        <Select label="FDR hjemmelag" value={String(homeFdr)} onChange={(v) => setHomeFdr(Number(v))} options={[1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: String(n) }))} />
        <Select label="FDR bortelag" value={String(awayFdr)} onChange={(v) => setAwayFdr(Number(v))} options={[1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: String(n) }))} />
        <button onClick={addFixture} className="flex items-center justify-center gap-1 self-end rounded-lg bg-emerald-500 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-emerald-400">
          <Plus size={14} /> Legg til kamp
        </button>
      </div>

      <div className="mt-4 divide-y divide-pitch-border rounded-xl border border-pitch-border bg-pitch-surface">
        {fixtures.map((f) => (
          <div key={f.id} className="flex items-center justify-between px-4 py-2.5 text-sm text-white">
            <span>
              Runde {f.gameweek?.number}: {f.home_team?.name} <FDRBadge rating={f.home_fdr} /> vs {f.away_team?.name} <FDRBadge rating={f.away_fdr} />
            </span>
            <span className="font-mono text-xs text-slate-500">{new Date(f.kickoff_at).toLocaleString("no-NO")}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <div>
      <label className="text-xs text-slate-500">{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 block w-full rounded-lg border border-pitch-border bg-pitch px-3 py-2 text-sm text-white outline-none focus:border-violet-500">
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}
