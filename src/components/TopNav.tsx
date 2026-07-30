"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Trophy, ShieldCheck } from "lucide-react";
import { MAIN_NAV } from "./navConfig";

export default function TopNav() {
  const pathname = usePathname();
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    async function check() {
      const { data } = await supabase.auth.getUser();
      setSignedIn(!!data.user);
      if (data.user) {
        const { data: profile } = await supabase.from("profiles").select("is_admin").eq("id", data.user.id).single();
        setIsAdmin(!!profile?.is_admin);
      }
    }
    check();
  }, [supabase]);

  return (
    <header className="sticky top-0 z-40 hidden border-b border-pitch-border bg-pitch/95 backdrop-blur md:block">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
        <Link href="/" className="flex items-center gap-2 font-display text-lg font-bold tracking-tight text-white">
          <Trophy size={20} className="text-emerald-400" />
          GFF
        </Link>

        <nav className="flex gap-1">
          {MAIN_NAV.map((item) => {
            const active = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition ${
                  active ? "bg-violet-600 text-white" : "text-slate-400 hover:bg-pitch-surface hover:text-white"
                }`}
              >
                <Icon size={16} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-3">
          {isAdmin && (
            <Link href="/admin" className="flex items-center gap-1 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm font-bold text-amber-300 hover:bg-amber-500/20">
              <ShieldCheck size={15} /> Admin
            </Link>
          )}
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
      </div>
    </header>
  );
}
