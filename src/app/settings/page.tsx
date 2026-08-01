"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function SettingsPage() {
  const supabase = createClient();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [teamId, setTeamId] = useState<string | null>(null);
  const [teamName, setTeamName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        router.push("/login");
        return;
      }
      const [{ data: team }, { data: profile }] = await Promise.all([
        supabase.from("fantasy_teams").select("*").eq("user_id", userData.user.id).maybeSingle(),
        supabase.from("profiles").select("*").eq("id", userData.user.id).single(),
      ]);
      if (team) {
        setTeamId(team.id);
        setTeamName(team.team_name);
      }
      setDisplayName(profile?.display_name ?? "");
      setLoading(false);
    }
    load();
  }, [supabase, router]);

  async function save() {
    setSaving(true);
    setMessage(null);
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

    await supabase.from("profiles").update({ display_name: displayName }).eq("id", userData.user.id);
    if (teamId) await supabase.from("fantasy_teams").update({ team_name: teamName }).eq("id", teamId);

    setSaving(false);
    setMessage("Saved!");
  }

  if (loading) return <div className="mx-auto max-w-lg px-4 py-10 text-slate-500">Loading…</div>;

  return (
    <div className="mx-auto max-w-lg px-4 py-6">
      <h1 className="font-display text-2xl font-black text-slate-900">Settings</h1>

      <div className="mt-4 space-y-4">
        <div>
          <label className="text-xs font-semibold text-slate-500">Your name</label>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="mt-1 w-full rounded-lg border border-pitch-border bg-pitch-surface px-3 py-2 text-slate-900 outline-none focus:border-slate-900"
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-500">Team name</label>
          <input
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
            className="mt-1 w-full rounded-lg border border-pitch-border bg-pitch-surface px-3 py-2 text-slate-900 outline-none focus:border-slate-900"
          />
        </div>

        {message && <p className="text-sm text-emerald-600">{message}</p>}

        <button
          onClick={save}
          disabled={saving}
          className="w-full rounded-lg bg-emerald-500 py-2.5 font-bold text-slate-950 hover:bg-emerald-400 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save changes"}
        </button>

        <a href="/api/auth/signout" className="block w-full rounded-lg border border-rose-500/30 bg-rose-500/10 py-2.5 text-center font-bold text-rose-700 hover:bg-rose-500/20">
          Log out
        </a>
      </div>
    </div>
  );
}
