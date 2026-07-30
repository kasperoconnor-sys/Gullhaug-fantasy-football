"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Lock } from "lucide-react";

export default function AchievementsPage() {
  const supabase = createClient();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [catalog, setCatalog] = useState<any[]>([]);
  const [unlocked, setUnlocked] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    async function load() {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        router.push("/login");
        return;
      }
      const { data: team } = await supabase.from("fantasy_teams").select("id").eq("user_id", userData.user.id).single();
      const { data: all } = await supabase.from("achievements").select("*");
      setCatalog(all ?? []);

      if (team) {
        const { data: mine } = await supabase
          .from("manager_achievements")
          .select("achievement_id, unlocked_at")
          .eq("fantasy_team_id", team.id);
        setUnlocked(new Map((mine ?? []).map((m: any) => [m.achievement_id, m.unlocked_at])));
      }
      setLoading(false);
    }
    load();
  }, [supabase, router]);

  if (loading) return <div className="mx-auto max-w-2xl px-4 py-10 text-slate-400">Loading…</div>;

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="font-display text-2xl font-black text-white">Achievements</h1>
      <p className="mt-1 text-sm text-slate-500">
        {unlocked.size} / {catalog.length} unlocked
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {catalog.map((a) => {
          const isUnlocked = unlocked.has(a.id);
          return (
            <div
              key={a.id}
              className={`rounded-xl border p-4 ${
                isUnlocked ? "border-violet-500/40 bg-violet-500/10" : "border-pitch-border bg-pitch-surface opacity-60"
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-2xl">{isUnlocked ? a.icon : <Lock size={20} className="text-slate-600" />}</span>
                <span className="font-bold text-white">{a.name}</span>
              </div>
              <p className="mt-1 text-xs text-slate-400">{a.description}</p>
              {isUnlocked && (
                <p className="mt-2 text-[11px] font-semibold text-violet-400">
                  Unlocked {new Date(unlocked.get(a.id)!).toLocaleDateString("en-GB")}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
