import { createClient } from "@/lib/supabase/server";
import { FORMATIONS } from "@/types";
import { isValidFormationCounts } from "@/lib/scoring";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabase = createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return NextResponse.json({ error: "Ikke innlogget." }, { status: 401 });

  const body = await request.json();
  const { fantasy_team_id, gameweek_id, formation, starters, bench, captain_player_id, vice_captain_player_id } = body as {
    fantasy_team_id: string;
    gameweek_id: string;
    formation: string;
    starters: string[];
    bench: string[];
    captain_player_id: string;
    vice_captain_player_id: string;
  };

  const { data: team } = await supabase.from("fantasy_teams").select("*").eq("id", fantasy_team_id).single();
  if (!team || team.user_id !== userData.user.id) {
    return NextResponse.json({ error: "Fant ikke laget ditt." }, { status: 403 });
  }

  const { data: gw } = await supabase.from("gameweeks").select("*").eq("id", gameweek_id).single();
  if (!gw || gw.status === "locked" || gw.status === "completed") {
    return NextResponse.json({ error: "Runden er låst for endringer." }, { status: 400 });
  }

  const { data: squadPlayers } = await supabase
    .from("fantasy_squad_players")
    .select("player:players(*)")
    .eq("fantasy_team_id", fantasy_team_id);
  const squadIds = new Set((squadPlayers ?? []).map((r: any) => r.player.id));
  if (![...starters, ...bench].every((id) => squadIds.has(id))) {
    return NextResponse.json({ error: "Ugyldig spiller i laget." }, { status: 400 });
  }

  const positions = new Map((squadPlayers ?? []).map((r: any) => [r.player.id, r.player.position]));
  const counts = { GK: 0, DEF: 0, MID: 0, FWD: 0 };
  starters.forEach((id) => {
    const pos = positions.get(id) as keyof typeof counts;
    counts[pos]++;
  });
  if (!isValidFormationCounts(counts, FORMATIONS[formation])) {
    return NextResponse.json({ error: "Ugyldig formasjon for valgt startoppstilling." }, { status: 400 });
  }
  if (!starters.includes(captain_player_id) || !starters.includes(vice_captain_player_id)) {
    return NextResponse.json({ error: "Kaptein og visekaptein må være i startoppstillingen." }, { status: 400 });
  }

  const { data: lineup, error: lineupError } = await supabase
    .from("gameweek_lineups")
    .upsert(
      {
        fantasy_team_id,
        gameweek_id,
        formation,
        captain_player_id,
        vice_captain_player_id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "fantasy_team_id,gameweek_id" }
    )
    .select()
    .single();
  if (lineupError) return NextResponse.json({ error: lineupError.message }, { status: 500 });

  await supabase.from("gameweek_lineup_slots").delete().eq("lineup_id", lineup.id);

  const slotRows = [
    ...starters.map((id: string) => ({ lineup_id: lineup.id, player_id: id, is_starter: true, bench_order: null })),
    ...bench.map((id: string, i: number) => ({ lineup_id: lineup.id, player_id: id, is_starter: false, bench_order: i + 1 })),
  ];
  const { error: slotsError } = await supabase.from("gameweek_lineup_slots").insert(slotRows);
  if (slotsError) return NextResponse.json({ error: slotsError.message }, { status: 500 });

  return NextResponse.json({ ok: true, lineup_id: lineup.id });
}
