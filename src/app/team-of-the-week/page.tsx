import { createClient } from "@/lib/supabase/server";

export const revalidate = 120;

export default async function TeamOfTheWeekPage() {
  const supabase = createClient();

  const { data: archive } = await supabase
    .from("team_of_the_week")
    .select("*, gameweek:gameweeks(*), players:team_of_the_week_players(*, player:players(*, team:teams(*)))")
    .order("created_at", { ascending: false });

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="font-display text-2xl font-black text-white">Ukens lag</h1>
      <p className="mt-1 text-sm text-slate-500">Historikk over alle runders beste lag.</p>

      <div className="mt-6 space-y-6">
        {(archive ?? []).map((totw: any) => (
          <div key={totw.id} className="rounded-2xl border border-pitch-border bg-gradient-to-br from-violet-600/10 to-emerald-600/10 p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-bold text-white">Runde {totw.gameweek?.number}</h2>
              <span className="font-mono text-sm text-slate-400">{totw.formation}</span>
            </div>
            <div className="mt-1 font-mono text-3xl font-black text-white">{totw.total_points} poeng</div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {totw.players.map((tp: any) => (
                <div key={tp.id} className="flex items-center justify-between rounded-lg border border-pitch-border bg-pitch-surface px-3 py-2">
                  <span className="text-sm text-white">
                    {tp.player.name} {tp.is_captain && <span className="text-amber-400">(C)</span>}
                  </span>
                  <span className="font-mono text-sm font-bold text-emerald-400">{tp.points} p</span>
                </div>
              ))}
            </div>
          </div>
        ))}
        {(!archive || archive.length === 0) && (
          <p className="text-sm text-slate-500">Ukens lag genereres automatisk etter at en runde er fullført.</p>
        )}
      </div>
    </div>
  );
}
