"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Menu, X } from "lucide-react";
import { MAIN_NAV, BOTTOM_NAV_PRIMARY } from "./navConfig";

export default function BottomNav() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setSignedIn(!!data.user));
  }, [supabase]);

  const primary = MAIN_NAV.filter((item) => BOTTOM_NAV_PRIMARY.includes(item.href));
  const overflow = MAIN_NAV.filter((item) => !BOTTOM_NAV_PRIMARY.includes(item.href));

  return (
    <>
      {moreOpen && (
        <div className="fixed inset-0 z-40 bg-black/60 md:hidden" onClick={() => setMoreOpen(false)}>
          <div
            className="absolute bottom-16 left-0 right-0 rounded-t-2xl border-t border-pitch-border bg-pitch-surface p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <span className="font-display text-sm font-bold text-white">More</span>
              <button onClick={() => setMoreOpen(false)}>
                <X size={18} className="text-slate-400" />
              </button>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {overflow.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMoreOpen(false)}
                    className="flex flex-col items-center gap-1 rounded-xl border border-pitch-border bg-pitch px-2 py-3 text-center"
                  >
                    <Icon size={18} className="text-violet-400" />
                    <span className="text-[11px] font-medium text-slate-300">{item.label}</span>
                  </Link>
                );
              })}
              <Link
                href="/chips"
                onClick={() => setMoreOpen(false)}
                className="flex flex-col items-center gap-1 rounded-xl border border-pitch-border bg-pitch px-2 py-3 text-center"
              >
                <span className="text-lg">⚡</span>
                <span className="text-[11px] font-medium text-slate-300">Chips</span>
              </Link>
              <Link
                href="/rules"
                onClick={() => setMoreOpen(false)}
                className="flex flex-col items-center gap-1 rounded-xl border border-pitch-border bg-pitch px-2 py-3 text-center"
              >
                <span className="text-lg">📖</span>
                <span className="text-[11px] font-medium text-slate-300">Rules</span>
              </Link>
              <Link
                href={signedIn ? "/api/auth/signout" : "/login"}
                onClick={() => setMoreOpen(false)}
                className="flex flex-col items-center gap-1 rounded-xl border border-pitch-border bg-pitch px-2 py-3 text-center"
              >
                <span className="text-lg">{signedIn ? "🚪" : "🔑"}</span>
                <span className="text-[11px] font-medium text-slate-300">{signedIn ? "Log out" : "Log in"}</span>
              </Link>
            </div>
          </div>
        </div>
      )}

      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-pitch-border bg-pitch/95 backdrop-blur md:hidden">
        <div className="grid grid-cols-5">
          {primary.map((item) => {
            const active = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href} className="flex flex-col items-center gap-0.5 py-2.5">
                <Icon size={20} className={active ? "text-emerald-400" : "text-slate-500"} />
                <span className={`text-[10px] font-medium ${active ? "text-emerald-400" : "text-slate-500"}`}>{item.label}</span>
              </Link>
            );
          })}
          <button onClick={() => setMoreOpen(true)} className="flex flex-col items-center gap-0.5 py-2.5">
            <Menu size={20} className="text-slate-500" />
            <span className="text-[10px] font-medium text-slate-500">More</span>
          </button>
        </div>
      </nav>
    </>
  );
}
