"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ChipType } from "@/types";
import { Zap, Shield, TrendingUp, Plane } from "lucide-react";

const CHIPS: { id: ChipType; name: string; description: string; icon: any }[] = [
  { id: "wildcard", name: "Wildcard", description: "Unlimited free transfers this gameweek.", icon: Zap },
  { id: "goal_rush", name: "Goal Rush", description: "Every goal your players score is worth +2 extra points.", icon: TrendingUp },
  { id: "super_defence", name: "Super Defence", description: "Goalkeepers and defenders get +2 extra for a clean sheet.", icon: Shield },
  { id: "away_advantage", name: "Away Advantage", description: "Players on an away team that wins get +2 points.", icon: Plane },
];

export default function ChipsPage() {
  const supabase = createClient();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [fantasyTeamId, setFantasyTeamId] = useState<string | null>(null);
  const [gameweekId, setGameweekId] = useState<string | null>(null);
  const [used, setUsed] = useState<ChipType[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        router.push("/login");
        return;
      }
      const { data: team } = await supabase.from("fantasy_teams").select("*").eq("user_id", userData.user.id).single();
      if (!team) return;
      setFantasyTeamId(team.id);

      const { data: gw } = await supabase
        .from("gameweeks")
        .select("*")
        .in("status", ["upcoming", "open"])
        .order("number")
        .limit(1)
        .maybeSingle();
      if (gw) setGameweekId(gw.id);

      const { data: usages } = await supabase.from("chip_usages").select("chip").eq("fantasy_team_id", team.id);
      setUsed((usages ?? []).map((u) => u.chip));
      setLoading(false);
    }
    load();
  }, [supabase, router]);

  async function activate(chip: ChipType) {
    if (!fantasyTeamId || !gameweekId) return;
    setMessage(null);
    const res = await fetch("/api/chips", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fantasy_team_id: fantasyTeamId, gameweek_id: gameweekId, chip }),
    });
    const body = await res.json();
    if (!res.ok) {
      setMessage(body.error ?? "Couldn't activate chip.");
      return;
    }
    setUsed([...used, chip]);
    setMessage(`${chip} is activated for this gameweek!`);
  }

  if (loading) return <div className="mx-auto max-w-2xl px-4 py-10 text-slate-400">Loading…</div>;

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="font-display text-2xl font-black text-white">Chips</h1>
      <p className="mt-1 text-sm text-slate-500">Each chip can only be used once per season.</p>

      {message && <p className="mt-3 text-sm text-emerald-400">{message}</p>}

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {CHIPS.map(({ id, name, description, icon: Icon }) => {
          const isUsed = used.includes(id);
          return (
            <div key={id} className={`rounded-xl border p-4 ${isUsed ? "border-pitch-border bg-pitch-surface/40 opacity-50" : "border-violet-500/30 bg-pitch-surface"}`}>
              <div className="flex items-center gap-2 text-white">
                <Icon size={18} className="text-violet-400" />
                <span className="font-bold">{name}</span>
              </div>
              <p className="mt-1 text-xs text-slate-400">{description}</p>
              <button
                onClick={() => activate(id)}
                disabled={isUsed}
                className="mt-3 w-full rounded-lg bg-violet-600 py-2 text-sm font-bold text-white hover:bg-violet-500 disabled:bg-slate-800 disabled:text-slate-500"
              >
                {isUsed ? "Already used" : "Activate for this gameweek"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
