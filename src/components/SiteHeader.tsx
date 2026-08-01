"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Bell, Settings, ShieldCheck, User } from "lucide-react";
import GFFLogo from "./GFFLogo";

export default function SiteHeader() {
  const supabase = createClient();
  const [signedIn, setSignedIn] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [seasonLabel, setSeasonLabel] = useState<string | null>(null);
  const [status, setStatus] = useState<{ mode: "live" | "deadline"; text: string } | null>(null);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<{ id: string; text: string }[]>([]);

  useEffect(() => {
    async function load() {
      const { data: userData } = await supabase.auth.getUser();
      setSignedIn(!!userData.user);

      let fantasyTeamId: string | null = null;
      if (userData.user) {
        const { data: profile } = await supabase.from("profiles").select("is_admin").eq("id", userData.user.id).single();
        setIsAdmin(!!profile?.is_admin);
        const { data: team } = await supabase.from("fantasy_teams").select("id").eq("user_id", userData.user.id).maybeSingle();
        fantasyTeamId = team?.id ?? null;
      }

      const { data: season } = await supabase.from("seasons").select("label").eq("is_current", true).maybeSingle();
      setSeasonLabel(season?.label ?? null);

      const { data: gw } = await supabase
        .from("gameweeks")
        .select("*")
        .in("status", ["upcoming", "open", "in_progress"])
        .order("number", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (gw) {
        if (gw.status === "in_progress") {
          const { count } = await supabase
            .from("fixtures")
            .select("*", { count: "exact", head: true })
            .eq("gameweek_id", gw.id)
            .eq("is_final", false)
            .lte("kickoff_at", new Date().toISOString());
          setStatus({ mode: "live", text: `LIVE • GW${gw.number} • ${count ?? 0} Matches Live` });
        } else {
          const diff = new Date(gw.deadline_at).getTime() - Date.now();
          if (diff > 0) {
            const d = Math.floor(diff / (1000 * 60 * 60 * 24));
            const h = Math.floor((diff / (1000 * 60 * 60)) % 24);
            setStatus({ mode: "deadline", text: `GW${gw.number} • Deadline in ${d}d ${h}h` });
          }
        }
      }

      if (fantasyTeamId) {
        const [{ data: recentAch }, { data: recentAwards }] = await Promise.all([
          supabase.from("manager_achievements").select("*, achievement:achievements(name, icon)").eq("fantasy_team_id", fantasyTeamId).order("unlocked_at", { ascending: false }).limit(3),
          supabase.from("weekly_awards").select("*, gameweek:gameweeks(number)").eq("fantasy_team_id", fantasyTeamId).order("created_at", { ascending: false }).limit(3),
        ]);
        const items = [
          ...(recentAch ?? []).map((a: any) => ({ id: `ach-${a.id}`, text: `${a.achievement?.icon} Unlocked "${a.achievement?.name}"` })),
          ...(recentAwards ?? []).map((a: any) => ({ id: `awd-${a.id}`, text: `🏅 Won an award in GW${a.gameweek?.number}` })),
        ];
        setNotifications(items);
      }
    }
    load();
  }, [supabase]);

  return (
    <header className="sticky top-0 z-40 border-b border-pitch-border bg-pitch/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-2.5">
        <Link href="/" className="flex items-center gap-2 font-display text-base font-bold tracking-tight text-white shrink-0">
          <GFFLogo size={20} />
          GFF
          {seasonLabel && <span className="rounded bg-pitch-surface px-1.5 py-0.5 text-[10px] font-bold text-slate-400">S{seasonLabel}</span>}
        </Link>

        {status && (
          <div
            className={`hidden truncate rounded-full px-3 py-1 text-xs font-bold sm:block ${
              status.mode === "live" ? "bg-rose-500/15 text-rose-400 animate-pulse-live" : "bg-violet-500/15 text-violet-300"
            }`}
          >
            {status.mode === "live" ? "🔴" : "⏳"} {status.text}
          </div>
        )}

        <div className="flex items-center gap-1.5 shrink-0">
          {signedIn && (
            <div className="relative">
              <button onClick={() => setNotifOpen(!notifOpen)} className="rounded-lg p-2 text-slate-400 hover:bg-pitch-surface hover:text-white">
                <Bell size={17} />
                {notifications.length > 0 && <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-emerald-400" />}
              </button>
              {notifOpen && (
                <div className="absolute right-0 top-11 w-64 rounded-xl border border-pitch-border bg-pitch-surface p-2 shadow-xl">
                  {notifications.length === 0 && <p className="px-2 py-3 text-xs text-slate-500">Nothing new yet.</p>}
                  {notifications.map((n) => (
                    <div key={n.id} className="rounded-lg px-2 py-2 text-xs text-slate-300 hover:bg-pitch">
                      {n.text}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {signedIn && (
            <Link href="/all-time" className="rounded-lg p-2 text-slate-400 hover:bg-pitch-surface hover:text-white">
              <User size={17} />
            </Link>
          )}

          {signedIn && (
            <Link href="/settings" className="rounded-lg p-2 text-slate-400 hover:bg-pitch-surface hover:text-white">
              <Settings size={17} />
            </Link>
          )}

          {isAdmin && (
            <Link href="/admin" className="flex items-center gap-1 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5 text-xs font-bold text-amber-300 hover:bg-amber-500/20">
              <ShieldCheck size={14} /> <span className="hidden sm:inline">Admin</span>
            </Link>
          )}

          {!signedIn && (
            <Link href="/login" className="rounded-lg bg-violet-600 px-3 py-1.5 text-sm font-bold text-white hover:bg-violet-500">
              Log in
            </Link>
          )}
        </div>
      </div>

      {status && (
        <div className={`px-4 pb-1.5 text-[11px] font-bold sm:hidden ${status.mode === "live" ? "text-rose-400" : "text-violet-300"}`}>
          {status.mode === "live" ? "🔴" : "⏳"} {status.text}
        </div>
      )}
    </header>
  );
}
