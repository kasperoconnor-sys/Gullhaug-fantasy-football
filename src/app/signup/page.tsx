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
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const signupRes = await fetch("/api/auth/admin-signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, display_name: displayName, team_name: teamName }),
    });
    const signupBody = await signupRes.json();
    if (!signupRes.ok) {
      setLoading(false);
      setError(signupBody.error ?? "Couldn't create user.");
      return;
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (signInError) {
      setError(signInError.message);
      return;
    }

    router.push("/squad");
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-sm px-4 py-16">
      <h1 className="font-display text-2xl font-black text-slate-900">Create account</h1>
      <p className="mt-1 text-sm text-slate-500">Become a manager in Gullhaug Fantasy Football</p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <Field label="Your name" value={displayName} onChange={setDisplayName} />
        <Field label="Team name" value={teamName} onChange={setTeamName} placeholder="e.g. Gullhaug Giants" />
        <Field label="Email" value={email} onChange={setEmail} type="email" />
        <Field label="Password" value={password} onChange={setPassword} type="password" />
        {error && <p className="text-sm text-rose-600">{error}</p>}
        {infoMessage && <p className="text-sm text-emerald-600">{infoMessage}</p>}
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
        <Link href="/login" className="font-semibold text-emerald-700">
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
      <label className="text-xs font-semibold text-slate-500">{label}</label>
      <input
        type={type}
        required
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border border-pitch-border bg-pitch-surface px-3 py-2 text-slate-900 outline-none focus:border-slate-900"
      />
    </div>
  );
}
