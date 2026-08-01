"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { Users, Plus } from "lucide-react";

export default function LeaguesPage() {
  const supabase = createClient();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [fantasyTeamId, setFantasyTeamId] = useState<string | null>(null);
  const [leagues, setLeagues] = useState<any[]>([]);
  const [newLeagueName, setNewLeagueName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
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

      const { data: memberships } = await supabase
        .from("league_members")
        .select("league:fantasy_leagues(*)")
        .eq("fantasy_team_id", team.id);
      setLeagues((memberships ?? []).map((m: any) => m.league));
      setLoading(false);
    }
    load();
  }, [supabase, router]);

  function randomCode() {
    return Math.random().toString(36).slice(2, 8).toUpperCase();
  }

  async function createLeague() {
    if (!fantasyTeamId || !newLeagueName.trim()) return;
    const { data: userData } = await supabase.auth.getUser();
    const code = randomCode();
    const { data: league, error } = await supabase
      .from("fantasy_leagues")
      .insert({ name: newLeagueName, invite_code: code, created_by: userData.user!.id })
      .select()
      .single();
    if (error) {
      setMessage(error.message);
      return;
    }
    await supabase.from("league_members").insert({ league_id: league.id, fantasy_team_id: fantasyTeamId });
    setLeagues([...leagues, league]);
    setNewLeagueName("");
    setMessage(`League created! Invite code: ${code}`);
  }

  async function joinLeague() {
    if (!fantasyTeamId || !inviteCode.trim()) return;
    setMessage(null);
    const res = await fetch("/api/leagues/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fantasy_team_id: fantasyTeamId, invite_code: inviteCode.trim().toUpperCase() }),
    });
    const body = await res.json();
    if (!res.ok) {
      setMessage(body.error ?? "Couldn't join league.");
      return;
    }
    setLeagues([...leagues, body.league]);
    setInviteCode("");
    setMessage(`You're now in ${body.league.name}!`);
  }

  if (loading) return <div className="mx-auto max-w-2xl px-4 py-10 text-slate-500">Loading…</div>;

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="font-display text-2xl font-black text-slate-900">Leagues</h1>

      {message && <p className="mt-3 text-sm text-emerald-400">{message}</p>}

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-pitch-border bg-pitch-surface p-4">
          <h2 className="text-sm font-bold text-slate-900">Create new league</h2>
          <input
            value={newLeagueName}
            onChange={(e) => setNewLeagueName(e.target.value)}
            placeholder="League name"
            className="mt-2 w-full rounded-lg border border-pitch-border bg-pitch px-3 py-2 text-sm text-slate-900 outline-none focus:border-violet-500"
          />
          <button onClick={createLeague} className="mt-2 flex w-full items-center justify-center gap-1 rounded-lg bg-violet-600 py-2 text-sm font-bold text-white hover:bg-violet-500">
            <Plus size={14} /> Create
          </button>
        </div>
        <div className="rounded-xl border border-pitch-border bg-pitch-surface p-4">
          <h2 className="text-sm font-bold text-slate-900">Join with a code</h2>
          <input
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value)}
            placeholder="Invite code"
            className="mt-2 w-full rounded-lg border border-pitch-border bg-pitch px-3 py-2 text-sm text-slate-900 outline-none focus:border-violet-500"
          />
          <button onClick={joinLeague} className="mt-2 w-full rounded-lg bg-emerald-500 py-2 text-sm font-bold text-slate-950 hover:bg-emerald-400">
            Join
          </button>
        </div>
      </div>

      <h2 className="mt-8 text-sm font-bold text-slate-500">Your leagues</h2>
      <div className="mt-2 space-y-2">
        {leagues.map((l) => (
          <Link key={l.id} href={`/leagues/${l.id}`} className="flex items-center justify-between rounded-xl border border-pitch-border bg-pitch-surface px-4 py-3 hover:border-violet-500/50">
            <span className="flex items-center gap-2 font-semibold text-slate-900">
              <Users size={16} className="text-slate-500" />
              {l.name}
            </span>
            <span className="font-mono text-xs text-slate-500">{l.invite_code}</span>
          </Link>
        ))}
        {leagues.length === 0 && <p className="text-sm text-slate-500">You're not in any leagues yet.</p>}
      </div>
    </div>
  );
}
