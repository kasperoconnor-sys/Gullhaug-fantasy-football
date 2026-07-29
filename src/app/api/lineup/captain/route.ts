import { createClient } from "@/lib/supabase/server";
import { canChangeCaptain } from "@/lib/scoring";
import { NextResponse } from "next/server";

/**
 * Rolling captain: a manager may keep changing captain during a live
 * gameweek, but only to a player whose fixture has not yet kicked off.
 */
export async function POST(request: Request) {
  const supabase = createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return NextResponse.json({ error: "Not logged in." }, { status: 401 });

  const { lineup_id, new_captain_player_id } = (await request.json()) as {
    lineup_id: string;
    new_captain_player_id: string;
  };

  const { data: lineup } = await supabase
    .from("gameweek_lineups")
    .select("*, fantasy_team:fantasy_teams(*), slots:gameweek_lineup_slots(*)")
    .eq("id", lineup_id)
    .single();

  if (!lineup || lineup.fantasy_team.user_id !== userData.user.id) {
    return NextResponse.json({ error: "Couldn't find the lineup." }, { status: 403 });
  }

  const isStarter = lineup.slots.some((s: any) => s.player_id === new_captain_player_id && s.is_starter);
  if (!isStarter) {
    return NextResponse.json({ error: "New captain must be in the starting XI." }, { status: 400 });
  }

  // Find the candidate's fixture this gameweek via their real-life team.
  const { data: player } = await supabase.from("players").select("team_id").eq("id", new_captain_player_id).single();
  const { data: fixture } = await supabase
    .from("fixtures")
    .select("kickoff_at")
    .eq("gameweek_id", lineup.gameweek_id)
    .or(`home_team_id.eq.${player?.team_id},away_team_id.eq.${player?.team_id}`)
    .maybeSingle();

  if (fixture && !canChangeCaptain(fixture.kickoff_at)) {
    return NextResponse.json({ error: "This player's match has already kicked off." }, { status: 400 });
  }

  const { error } = await supabase
    .from("gameweek_lineups")
    .update({ captain_player_id: new_captain_player_id, updated_at: new Date().toISOString() })
    .eq("id", lineup_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabase.from("lineup_events").insert({
    lineup_id,
    event_type: "captain_change",
    player_in_id: new_captain_player_id,
  });

  return NextResponse.json({ ok: true });
}
