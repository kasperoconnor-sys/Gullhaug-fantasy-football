import { createClient, createServiceClient } from "@/lib/supabase/server";
import { isValidFormationCounts } from "@/lib/scoring";
import { FORMATIONS } from "@/types";
import { NextResponse } from "next/server";

/**
 * Picks the highest-scoring valid XI for a completed gameweek and
 * archives it. Greedy-with-backtrack approach: try every formation,
 * fill each position with its top scorers, keep the best-scoring
 * valid combination.
 */
export async function POST(request: Request) {
  const supabase = createClient();
  const { data: userData } = await supabase.auth.getUser();
  const { data: profile } = userData.user
    ? await supabase.from("profiles").select("is_admin").eq("id", userData.user.id).single()
    : { data: null };
  if (!profile?.is_admin) return NextResponse.json({ error: "Kun admin kan gjøre dette." }, { status: 403 });

  const { gameweek_id } = (await request.json()) as { gameweek_id: string };
  const db = createServiceClient();

  const { data: points } = await db
    .from("fantasy_points")
    .select("*, player:players(*)")
    .eq("gameweek_id", gameweek_id)
    .order("points", { ascending: false });

  const byPos: Record<string, any[]> = { GK: [], DEF: [], MID: [], FWD: [] };
  (points ?? []).forEach((p: any) => byPos[p.player.position]?.push(p));

  let best: { formation: string; picks: any[]; total: number } | null = null;

  for (const [formation, need] of Object.entries(FORMATIONS)) {
    const gk = byPos.GK.slice(0, 1);
    const def = byPos.DEF.slice(0, need.DEF);
    const mid = byPos.MID.slice(0, need.MID);
    const fwd = byPos.FWD.slice(0, need.FWD);
    const picks = [...gk, ...def, ...mid, ...fwd];
    const counts = { GK: gk.length, DEF: def.length, MID: mid.length, FWD: fwd.length };
    if (!isValidFormationCounts(counts, need) || picks.length < 11) continue;

    const total = picks.reduce((sum, p) => sum + p.points, 0);
    if (!best || total > best.total) best = { formation, picks, total };
  }

  if (!best) return NextResponse.json({ error: "Ikke nok data til å generere ukens lag." }, { status: 400 });

  const topScorer = best.picks.reduce((a, b) => (b.points > a.points ? b : a));

  const { data: totw, error } = await db
    .from("team_of_the_week")
    .upsert({ gameweek_id, formation: best.formation, total_points: best.total }, { onConflict: "gameweek_id" })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await db.from("team_of_the_week_players").delete().eq("totw_id", totw.id);
  await db.from("team_of_the_week_players").insert(
    best.picks.map((p) => ({
      totw_id: totw.id,
      player_id: p.player.id,
      points: p.points,
      is_captain: p.player.id === topScorer.player.id,
    }))
  );

  return NextResponse.json({ ok: true, formation: best.formation, total_points: best.total });
}
