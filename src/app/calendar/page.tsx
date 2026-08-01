"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import FDRBadge from "@/components/FDRBadge";
import { ChevronDown, ChevronUp } from "lucide-react";

export default function CalendarPage() {
  const supabase = createClient();
  const [fixtures, setFixtures] = useState<any[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [details, setDetails] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("fixtures")
        .select("*, home_team:teams!fixtures_home_team_id_fkey(*), away_team:teams!fixtures_away_team_id_fkey(*)")
        .order("kickoff_at", { ascending: true });
      setFixtures(data ?? []);
      setLoading(false);
    }
    load();
  }, [supabase]);

  async function toggle(fixture: any) {
    if (expanded === fixture.id) {
      setExpanded(null);
      return;
    }
    setExpanded(fixture.id);
    if (!details[fixture.id]) {
      const { data } = await supabase
        .from("player_match_stats")
        .select("*, player:players(*)")
        .eq("fixture_id", fixture.id)
        .gt("goals", 0);
      setDetails((prev) => ({ ...prev, [fixture.id]: data ?? [] }));
    }
  }

  if (loading) return <div className="mx-auto max-w-2xl px-4 py-10 text-slate-500">Loading…</div>;

  const byMonth = new Map<string, any[]>();
  fixtures.forEach((f) => {
    const key = new Date(f.kickoff_at).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
    const list = byMonth.get(key) ?? [];
    list.push(f);
    byMonth.set(key, list);
  });

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="font-display text-2xl font-black text-slate-900">Fixture Calendar</h1>
      <p className="mt-1 text-sm text-slate-500">Tap a fixture for the score, scorers, and fantasy points.</p>

      {[...byMonth.entries()].map(([month, list]) => (
        <div key={month} className="mt-6">
          <h2 className="text-sm font-bold text-slate-500">{month}</h2>
          <div className="mt-2 space-y-2">
            {list.map((f) => (
              <div key={f.id} className="rounded-xl border border-pitch-border bg-pitch-surface">
                <button onClick={() => toggle(f)} className="flex w-full items-center justify-between px-4 py-3 text-left">
                  <div>
                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                      {f.home_team?.name} <FDRBadge rating={f.home_fdr} /> vs <FDRBadge rating={f.away_fdr} /> {f.away_team?.name}
                    </div>
                    <div className="text-xs text-slate-500">{new Date(f.kickoff_at).toLocaleDateString("en-GB")}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    {f.is_final && <span className="font-mono text-sm text-emerald-400">{f.home_score}–{f.away_score}</span>}
                    {expanded === f.id ? <ChevronUp size={16} className="text-slate-500" /> : <ChevronDown size={16} className="text-slate-500" />}
                  </div>
                </button>
                {expanded === f.id && (
                  <div className="border-t border-pitch-border px-4 py-3">
                    {!f.is_final && <p className="text-xs text-slate-500">Match hasn't been played yet.</p>}
                    {f.is_final && (details[f.id]?.length ?? 0) === 0 && <p className="text-xs text-slate-500">No goal scorers recorded.</p>}
                    {(details[f.id] ?? []).map((d: any) => (
                      <div key={d.id} className="flex items-center justify-between py-1 text-xs">
                        <span className="text-slate-900">⚽ {d.player?.name} × {d.goals}</span>
                        <span className="text-slate-500">{d.clean_sheet ? "Clean sheet" : ""}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
