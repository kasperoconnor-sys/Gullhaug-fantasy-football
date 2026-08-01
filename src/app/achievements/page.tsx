"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Lock } from "lucide-react";

const RARITY_STYLE: Record<string, string> = {
  common: "border-slate-200 bg-slate-50 text-slate-600",
  rare: "border-sky-200 bg-sky-50 text-sky-700",
  epic: "border-violet-200 bg-violet-50 text-violet-700",
  legendary: "border-amber-300 bg-amber-50 text-amber-700",
};

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

  if (loading) return <div className="mx-auto max-w-2xl px-4 py-10 text-slate-500">Loading…</div>;

  const rarityOrder = ["legendary", "epic", "rare", "common"];
  const sorted = [...catalog].sort((a, b) => rarityOrder.indexOf(a.rarity) - rarityOrder.indexOf(b.rarity));

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="font-display text-2xl font-black text-slate-900">Achievements</h1>
      <p className="mt-1 text-sm text-slate-500">
        {unlocked.size} / {catalog.length} unlocked
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {sorted.map((a) => {
          const isUnlocked = unlocked.has(a.id);
          return (
            <div
              key={a.id}
              className={`relative overflow-hidden rounded-2xl border p-4 transition-opacity duration-200 ${
                isUnlocked ? `${RARITY_STYLE[a.rarity]} animate-pop-in` : "border-pitch-border bg-pitch-surface opacity-50"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-3xl">{isUnlocked ? a.icon : <Lock size={26} className="text-slate-400" />}</span>
                <span className={`rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide ${isUnlocked ? RARITY_STYLE[a.rarity] : "border-pitch-border text-slate-400"}`}>
                  {a.rarity}
                </span>
              </div>
              <div className="mt-2 font-bold text-slate-900">{a.name}</div>
              <p className="mt-1 text-xs text-slate-500">{a.description}</p>
              {isUnlocked && (
                <p className="mt-2 text-[11px] font-semibold text-slate-500">
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
