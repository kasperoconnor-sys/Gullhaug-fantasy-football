"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Trophy, Menu, X } from "lucide-react";

const LINKS = [
  { href: "/squad", label: "My Team" },
  { href: "/lineup", label: "Lineup" },
  { href: "/transfers", label: "Transfers" },
  { href: "/chips", label: "Chips" },
  { href: "/leagues", label: "Leagues" },
  { href: "/statistics", label: "Statistics" },
  { href: "/team-of-the-week", label: "Team of the Week" },
];

export default function Nav() {
  const [open, setOpen] = useState(false);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setSignedIn(!!data.user));
  }, [supabase]);

  return (
    <header className="sticky top-0 z-40 border-b border-pitch-border bg-pitch/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/" className="flex items-center gap-2 font-display text-lg font-bold tracking-tight text-white">
          <Trophy size={20} className="text-emerald-400" />
          GFF
        </Link>

        <nav className="hidden gap-6 md:flex">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="text-sm font-medium text-slate-400 hover:text-white transition">
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="hidden md:block">
          {signedIn ? (
            <Link href="/api/auth/signout" className="text-sm font-semibold text-slate-400 hover:text-white">
              Log out
            </Link>
          ) : (
            <Link href="/login" className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-bold text-white hover:bg-violet-500">
              Log in
            </Link>
          )}
        </div>

        <button className="md:hidden text-white" onClick={() => setOpen(!open)} aria-label="Menu">
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {open && (
        <nav className="flex flex-col gap-1 border-t border-pitch-border px-4 py-3 md:hidden">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="rounded-lg px-3 py-2 text-sm font-medium text-slate-300 hover:bg-pitch-surface">
              {l.label}
            </Link>
          ))}
          <Link href={signedIn ? "/api/auth/signout" : "/login"} className="rounded-lg px-3 py-2 text-sm font-bold text-violet-400">
            {signedIn ? "Log out" : "Log in"}
          </Link>
        </nav>
      )}
    </header>
  );
}
