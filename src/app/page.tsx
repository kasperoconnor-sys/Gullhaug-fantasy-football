import { createClient } from "@/lib/supabase/server";
import FDRBadge from "@/components/FDRBadge";
import Link from "next/link";
import { Trophy, Shield, ArrowRight } from "lucide-react";

export const revalidate = 60;

export default async function HomePage() {
  const supabase = createClient();

  const { data: currentGw } = await supabase
    .from("gameweeks")
    .select("*")
    .in("status", ["open", "in_progress"])
    .order("number", { ascending: true })
    .limit(1)
    .maybeSingle();

  const { data: fixtures } = currentGw
    ? await supabase
        .from("fixtures")
        .select("*, home_team:teams!fixtures_home_team_id_fkey(*), away_team:teams!fixtures_away_team_id_fkey(*)")
        .eq("gameweek_id", currentGw.id)
        .order("kickoff_at", { ascending: true })
    : { data: [] as any[] };

  const { data: latestTotw } = await supabase
    .from("team_of_the_week")
    .select("*, gameweek:gameweeks(*)")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (
    <div>
      <section className="border-b border-pitch-border bg-gradient-to-br from-violet-950/40 via-pitch to-pitch">
        <div className="mx-auto max-w-6xl px-4 py-16">
          <div className="flex items-center gap-2 text-emerald-400">
            <Trophy size={20} />
            <span className="text-sm font-bold uppercase tracking-widest">Gullhaug Fantasy Football</span>
          </div>
          <h1 className="mt-3 max-w-2xl font-display text-4xl font-black leading-tight text-white md:text-5xl">
            Bygg laget. Velg kapteinen. Slå kompisene dine.
          </h1>
          <p className="mt-3 max-w-xl text-slate-400">
            Fantasy football for Gullhaug 1, Gullhaug 2 og alle lagene vi møter i seriene våre.
            {currentGw ? ` Runde ${currentGw.number} er ${currentGw.status === "open" ? "åpen" : "i gang"}.` : ""}
          </p>
          <div className="mt-6 flex gap-3">
            <Link href="/squad" className="rounded-lg bg-emerald-500 px-5 py-3 font-bold text-slate-950 hover:bg-emerald-400">
              Bygg laget mitt
            </Link>
            <Link href="/statistics" className="rounded-lg border border-pitch-border px-5 py-3 font-bold text-white hover:bg-pitch-surface">
              Se statistikk
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-10">
        <h2 className="font-display text-xl font-bold text-white">
          {currentGw ? `Kamper — runde ${currentGw.number}` : "Ingen aktiv runde"}
        </h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {(fixtures ?? []).map((f: any) => (
            <div key={f.id} className="rounded-xl border border-pitch-border bg-pitch-surface p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-semibold text-white">
                  <Shield size={14} className="text-slate-500" />
                  {f.home_team?.name}
                  <FDRBadge rating={f.home_fdr} />
                </div>
                <span className="font-mono text-xs text-slate-500">
                  {f.is_final ? `${f.home_score}–${f.away_score}` : new Date(f.kickoff_at).toLocaleDateString("no-NO")}
                </span>
              </div>
              <div className="mt-2 flex items-center gap-2 text-sm font-semibold text-white">
                <Shield size={14} className="text-slate-500" />
                {f.away_team?.name}
                <FDRBadge rating={f.away_fdr} />
              </div>
            </div>
          ))}
          {(!fixtures || fixtures.length === 0) && (
            <p className="text-sm text-slate-500">Ingen kamper lagt inn for øyeblikket.</p>
          )}
        </div>
      </section>

      {latestTotw && (
        <section className="mx-auto max-w-6xl px-4 pb-16">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-xl font-bold text-white">
              Ukens lag — runde {latestTotw.gameweek?.number}
            </h2>
            <Link href="/team-of-the-week" className="flex items-center gap-1 text-sm font-semibold text-violet-400">
              Se alle <ArrowRight size={14} />
            </Link>
          </div>
          <div className="mt-3 rounded-xl border border-pitch-border bg-gradient-to-br from-violet-600/20 to-emerald-600/20 p-4">
            <div className="text-sm text-slate-300">Formasjon: {latestTotw.formation}</div>
            <div className="mt-1 font-mono text-3xl font-black text-white">{latestTotw.total_points} poeng</div>
          </div>
        </section>
      )}
    </div>
  );
}
