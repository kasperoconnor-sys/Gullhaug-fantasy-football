"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Eye, EyeOff } from "lucide-react";

function friendlyAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("already registered") || m.includes("already exists")) return "An account with this email already exists — try logging in instead.";
  if (m.includes("password")) return "Password must be at least 6 characters.";
  if (m.includes("invalid") && m.includes("email")) return "That doesn't look like a valid email address.";
  return message;
}

export default function SignupPage() {
  const [displayName, setDisplayName] = useState("");
  const [teamName, setTeamName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const cleanEmail = email.trim().toLowerCase();
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    const signupRes = await fetch("/api/auth/admin-signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: cleanEmail, password, display_name: displayName.trim(), team_name: teamName.trim() }),
    });
    const signupBody = await signupRes.json();
    if (!signupRes.ok) {
      setLoading(false);
      setError(friendlyAuthError(signupBody.error ?? "Couldn't create user."));
      return;
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({ email: cleanEmail, password });
    setLoading(false);
    if (signInError) {
      setError(friendlyAuthError(signInError.message));
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
        <div>
          <label className="text-xs font-semibold text-slate-500">Password</label>
          <div className="relative mt-1">
            <input
              type={showPassword ? "text" : "password"}
              required
              minLength={6}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-pitch-border bg-pitch-surface px-3 py-2 pr-10 text-slate-900 outline-none focus:border-slate-900"
            />
            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400" tabIndex={-1}>
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          <p className="mt-1 text-[11px] text-slate-500">At least 6 characters.</p>
        </div>
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
        autoCapitalize={type === "email" ? "none" : undefined}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border border-pitch-border bg-pitch-surface px-3 py-2 text-slate-900 outline-none focus:border-slate-900"
      />
    </div>
  );
}
