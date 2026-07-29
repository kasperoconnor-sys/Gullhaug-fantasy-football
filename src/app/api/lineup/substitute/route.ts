import { createClient } from "@/lib/supabase/server";
import { canMakeSubstitution, isValidFormationCounts } from "@/lib/scoring";
import { FORMATIONS } from "@/types";
import { NextResponse } from "next/server";

/**
 * Rolling substitution: swap a starter (who may have already played)
 * for a bench player whose match has not yet kicked off. The resulting
 * XI must still satisfy a valid formation.
 */
export async function POST(request: Request) {
  const supabase = createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return NextResponse.json({ error: "Not logged in." }, { status: 401 });

  const { lineup_id, player_out_id, player_in_id } = (await request.json()) as {
    lineup_id: string;
    player_out_id: string;
    player_in_id: string;
  };

  const { data: lineup } = await supabase
    .from("gameweek_lineups")
    .select("*, fantasy_team:fantasy_teams(*), slots:gameweek_lineup_slots(*)")
    .eq("id", lineup_id)
    .single();

  if (!lineup || lineup.fantasy_team.user_id !== userData.user.id) {
    return NextResponse.json({ error: "Couldn't find the lineup." }, { status: 403 });
  }

  const outSlot = lineup.slots.find((s: any) => s.player_id === player_out_id && s.is_starter);
  const inSlot = lineup.slots.find((s: any) => s.player_id === player_in_id && !s.is_starter);
  if (!outSlot || !inSlot) {
    return NextResponse.json({ error: "Invalid substitution — check the players are in the starting XI and on the bench respectively." }, { status: 400 });
  }

  const { data: incomingPlayer } = await supabase.from("players").select("team_id, position").eq("id", player_in_id).single();
  const { data: fixture } = await supabase
    .from("fixtures")
    .select("kickoff_at")
    .eq("gameweek_id", lineup.gameweek_id)
    .or(`home_team_id.eq.${incomingPlayer?.team_id},away_team_id.eq.${incomingPlayer?.team_id}`)
    .maybeSingle();

  if (fixture && !canMakeSubstitution(fixture.kickoff_at)) {
    return NextResponse.json({ error: "The incoming player's match has already kicked off." }, { status: 400 });
  }

  // Recompute formation counts after the swap.
  const { data: allPlayers } = await supabase.from("players").select("id, position");
  const posOf = new Map((allPlayers ?? []).map((p) => [p.id, p.position]));
  const counts = { GK: 0, DEF: 0, MID: 0, FWD: 0 };
  lineup.slots.forEach((s: any) => {
    let playerId = s.player_id;
    let isStarter = s.is_starter;
    if (playerId === player_out_id) isStarter = false;
    if (playerId === player_in_id) isStarter = true;
    if (isStarter) {
      const pos = posOf.get(playerId) as keyof typeof counts;
      if (pos) counts[pos]++;
    }
  });
  if (!isValidFormationCounts(counts, FORMATIONS[lineup.formation])) {
    return NextResponse.json({ error: "This substitution results in an invalid formation." }, { status: 400 });
  }

  await supabase.from("gameweek_lineup_slots").update({ is_starter: false, bench_order: 1 }).eq("id", outSlot.id);
  await supabase.from("gameweek_lineup_slots").update({ is_starter: true, bench_order: null }).eq("id", inSlot.id);

  let captainUpdate: Record<string, string> = {};
  if (lineup.captain_player_id === player_out_id) captainUpdate.captain_player_id = player_in_id;
  if (lineup.vice_captain_player_id === player_out_id) captainUpdate.vice_captain_player_id = player_in_id;
  if (Object.keys(captainUpdate).length > 0) {
    await supabase.from("gameweek_lineups").update(captainUpdate).eq("id", lineup_id);
  }

  await supabase.from("lineup_events").insert({
    lineup_id,
    event_type: "substitution",
    player_out_id,
    player_in_id,
  });

  return NextResponse.json({ ok: true });
}
