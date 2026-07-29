"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function SignupPage() {
  const [displayName, setDisplayName] = useState("");
  const [teamName, setTeamName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { data, error: signUpError } = await supabase.auth.signUp({ email, password });
    if (signUpError || !data.user) {
      setLoading(false);
      setError(signUpError?.message ?? "Couldn't create user.");
      return;
    }

    const { error: profileError } = await supabase
      .from("profiles")
      .insert({ id: data.user.id, display_name: displayName });
    if (profileError) {
      setLoading(false);
      setError(profileError.message);
      return;
    }

    const { data: settings } = await supabase.from("season_settings").select("starting_budget").single();

    const { error: teamError } = await supabase.from("fantasy_teams").insert({
      user_id: data.user.id,
      team_name: teamName,
      budget_remaining: settings?.starting_budget ?? 100.0,
      free_transfers: 1,
    });
    setLoading(false);
    if (teamError) {
      setError(teamError.message);
      return;
    }

    router.push("/squad");
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-sm px-4 py-16">
      <h1 className="font-display text-2xl font-black text-white">Create account</h1>
      <p className="mt-1 text-sm text-slate-500">Become a manager in Gullhaug Fantasy Football</p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <Field label="Your name" value={displayName} onChange={setDisplayName} />
        <Field label="Team name" value={teamName} onChange={setTeamName} placeholder="e.g. Gullhaug Giants" />
        <Field label="Email" value={email} onChange={setEmail} type="email" />
        <Field label="Password" value={password} onChange={setPassword} type="password" />
        {error && <p className="text-sm text-rose-400">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-emerald-500 py-2.5 font-bold text-slate-950 hover:bg-emerald-400 disabled:opacity-50"
        >
          {loading ? "Creating…" : "Create account"}
        </button>
      </form>

      <p className="mt-4 text-sm text-slate-500">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-violet-400">
          Log in
        </Link>
      </p>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="text-xs font-semibold text-slate-400">{label}</label>
      <input
        type={type}
        required
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border border-pitch-border bg-pitch-surface px-3 py-2 text-white outline-none focus:border-violet-500"
      />
    </div>
  );
}
