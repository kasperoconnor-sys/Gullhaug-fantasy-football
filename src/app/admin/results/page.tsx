"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { RefreshCw } from "lucide-react";

export default function AdminResultsPage() {
  const supabase = createClient();
  const [fixtures, setFixtures] = useState<any[]>([]);
  const [selectedFixtureId, setSelectedFixtureId] = useState("");
  const [homeScore, setHomeScore] = useState("0");
  const [awayScore, setAwayScore] = useState("0");
  const [rosterStats, setRosterStats] = useState<Record<string, any>>({});
  const [recalcMessage, setRecalcMessage] = useState<string | null>(null);
  const [recalculating, setRecalculating] = useState(false);

  async function loadFixtures() {
    const { data } = await supabase
      .from("fixtures")
      .select("*, home_team:teams!fixtures_home_team_id_fkey(*), away_team:teams!fixtures_away_team_id_fkey(*), gameweek:gameweeks(*)")
      .order("kickoff_at", { ascending: false });
    setFixtures(data ?? []);
    if (data && data.length > 0 && !selectedFixtureId) setSelectedFixtureId(data[0].id);
  }
  useEffect(() => {
    loadFixtures();
  }, []);

  const fixture = fixtures.find((f) => f.id === selectedFixtureId);

  useEffect(() => {
    async function loadRoster() {
      if (!fixture) return;
      const { data: players } = await supabase
        .from("players")
        .select("*, team:teams(*)")
        .in("team_id", [fixture.home_team_id, fixture.away_team_id])
        .eq("is_active", true);

      const { data: existingStats } = await supabase
        .from("player_match_stats")
        .select("*")
        .eq("fixture_id", fixture.id);
      const existingByPlayer = new Map((existingStats ?? []).map((s: any) => [s.player_id, s]));

      const initial: Record<string, any> = {};
      (players ?? []).forEach((p: any) => {
        const existing = existingByPlayer.get(p.id);
        initial[p.id] = existing ?? {
          player: p,
          minutes_played: 60,
          goals: 0,
          assists: 0,
          goals_conceded: 0,
          clean_sheet: false,
          yellow_cards: 0,
          red_cards: 0,
          own_goals: 0,
        };
        initial[p.id].player = p;
      });
      setRosterStats(initial);
      setHomeScore(String(fixture.home_score ?? 0));
      setAwayScore(String(fixture.away_score ?? 0));
    }
    loadRoster();
  }, [fixture?.id]);

  function updateStat(playerId: string, field: string, value: any) {
    setRosterStats((prev) => ({ ...prev, [playerId]: { ...prev[playerId], [field]: value } }));
  }

  async function saveResult() {
    if (!fixture) return;
    await supabase
      .from("fixtures")
      .update({ home_score: parseInt(homeScore), away_score: parseInt(awayScore), is_final: true })
      .eq("id", fixture.id);

    const homeConceded = parseInt(awayScore);
    const awayConceded = parseInt(homeScore);

    const rows = Object.values(rosterStats).map((s: any) => {
      const isHome = s.player.team_id === fixture.home_team_id;
      const conceded = isHome ? homeConceded : awayConceded;
      return {
        fixture_id: fixture.id,
        player_id: s.player.id,
        minutes_played: Number(s.minutes_played),
        goals: Number(s.goals),
        assists: s.player.team?.is_gullhaug ? Number(s.assists) : 0,
        goals_conceded: conceded,
        clean_sheet: conceded === 0 && Number(s.minutes_played) > 0,
        yellow_cards: Number(s.yellow_cards),
        red_cards: Number(s.red_cards),
        own_goals: Number(s.own_goals),
      };
    });

    await supabase.from("player_match_stats").upsert(rows, { onConflict: "fixture_id,player_id" });
    loadFixtures();
  }

  async function recalculate() {
    if (!fixture) return;
    setRecalculating(true);
    setRecalcMessage(null);
    const res = await fetch("/api/scoring/recalculate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gameweek_id: fixture.gameweek_id }),
    });
    const body = await res.json();
    setRecalculating(false);
    setRecalcMessage(res.ok ? `Points updated for ${body.teams_scored} teams.` : body.error);
  }

  return (
    <div>
      <h1 className="font-display text-2xl font-black text-slate-900">Enter Results</h1>
      <p className="mt-1 text-sm text-slate-500">
        Manual entry (fallback for when Min Fotball data can't be pulled automatically). Assists are only tracked for Gullhaug players.
      </p>

      <select
        value={selectedFixtureId}
        onChange={(e) => setSelectedFixtureId(e.target.value)}
        className="mt-4 block w-full rounded-lg border border-pitch-border bg-pitch-surface px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-900 sm:w-auto"
      >
        {fixtures.map((f) => (
          <option key={f.id} value={f.id}>
            Gameweek {f.gameweek?.number}: {f.home_team?.name} vs {f.away_team?.name}
          </option>
        ))}
      </select>

      {fixture && (
        <>
          <div className="mt-4 flex items-center gap-3 rounded-xl border border-pitch-border bg-pitch-surface p-4">
            <span className="text-sm font-semibold text-slate-900">{fixture.home_team?.name}</span>
            <input type="number" value={homeScore} onChange={(e) => setHomeScore(e.target.value)} className="w-16 rounded-lg border border-pitch-border bg-pitch px-2 py-1 text-center text-slate-900" />
            <span className="text-slate-500">–</span>
            <input type="number" value={awayScore} onChange={(e) => setAwayScore(e.target.value)} className="w-16 rounded-lg border border-pitch-border bg-pitch px-2 py-1 text-center text-slate-900" />
            <span className="text-sm font-semibold text-slate-900">{fixture.away_team?.name}</span>
          </div>

          <div className="mt-4 space-y-2">
            {Object.values(rosterStats).map((s: any) => (
              <div key={s.player.id} className="grid grid-cols-2 gap-2 rounded-xl border border-pitch-border bg-pitch-surface p-3 sm:grid-cols-8 sm:items-center">
                <span className="col-span-2 text-sm font-semibold text-slate-900 sm:col-span-2">{s.player.name}</span>
                <NumField label="Mins" value={s.minutes_played} onChange={(v) => updateStat(s.player.id, "minutes_played", v)} />
                <NumField label="Goals" value={s.goals} onChange={(v) => updateStat(s.player.id, "goals", v)} />
                {s.player.team?.is_gullhaug && <NumField label="Assist" value={s.assists} onChange={(v) => updateStat(s.player.id, "assists", v)} />}
                <NumField label="Yellow" value={s.yellow_cards} onChange={(v) => updateStat(s.player.id, "yellow_cards", v)} />
                <NumField label="Red" value={s.red_cards} onChange={(v) => updateStat(s.player.id, "red_cards", v)} />
                <NumField label="Own goals" value={s.own_goals} onChange={(v) => updateStat(s.player.id, "own_goals", v)} />
              </div>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button onClick={saveResult} className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-emerald-400">
              Save result & stats
            </button>
            <button onClick={recalculate} disabled={recalculating} className="flex items-center gap-1 rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-50">
              <RefreshCw size={14} className={recalculating ? "animate-spin" : ""} /> Update fantasy points
            </button>
            {recalcMessage && <span className="text-sm text-emerald-600">{recalcMessage}</span>}
          </div>
        </>
      )}
    </div>
  );
}

function NumField({ label, value, onChange }: { label: string; value: any; onChange: (v: any) => void }) {
  return (
    <div>
      <label className="text-[10px] text-slate-500">{label}</label>
      <input
        type="number"
        min={0}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-0.5 block w-full rounded-md border border-pitch-border bg-pitch px-2 py-1 text-sm text-slate-900 outline-none focus:border-slate-900"
      />
    </div>
  );
}
