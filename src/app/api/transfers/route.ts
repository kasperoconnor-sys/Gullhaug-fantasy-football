import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabase = createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return NextResponse.json({ error: "Not logged in." }, { status: 401 });

  const { fantasy_team_id, gameweek_id, player_out_id, player_in_id } = (await request.json()) as {
    fantasy_team_id: string;
    gameweek_id: string;
    player_out_id: string;
    player_in_id: string;
  };

  const { data: team } = await supabase.from("fantasy_teams").select("*").eq("id", fantasy_team_id).single();
  if (!team || team.user_id !== userData.user.id) {
    return NextResponse.json({ error: "Couldn't find your team." }, { status: 403 });
  }

  const { data: settings } = await supabase.from("season_settings").select("*").single();
  const { data: playerOut } = await supabase.from("players").select("*").eq("id", player_out_id).single();
  const { data: playerIn } = await supabase.from("players").select("*").eq("id", player_in_id).single();
  if (!playerOut || !playerIn) return NextResponse.json({ error: "Couldn't find the players." }, { status: 400 });
  if (playerOut.position !== playerIn.position) {
    return NextResponse.json({ error: "New player must have the same position." }, { status: 400 });
  }

  const newBudget = Math.round((team.budget_remaining + playerOut.price - playerIn.price) * 10) / 10;
  if (newBudget < 0) return NextResponse.json({ error: "Not enough budget for this transfer." }, { status: 400 });

  const wasFree = team.free_transfers > 0;
  const pointCost = wasFree ? 0 : settings?.extra_transfer_cost ?? 3;
  const newFreeTransfers = wasFree
    ? Math.max(0, team.free_transfers - 1)
    : team.free_transfers; // paid transfers don't touch the free-transfer bank

  await supabase.from("fantasy_squad_players").delete().eq("fantasy_team_id", fantasy_team_id).eq("player_id", player_out_id);
  await supabase.from("fantasy_squad_players").insert({
    fantasy_team_id,
    player_id: player_in_id,
    purchase_price: playerIn.price,
  });

  await supabase
    .from("transfers")
    .insert({ fantasy_team_id, gameweek_id, player_out_id, player_in_id, was_free: wasFree, point_cost: pointCost });

  await supabase
    .from("fantasy_teams")
    .update({ budget_remaining: newBudget, free_transfers: newFreeTransfers })
    .eq("id", fantasy_team_id);

  return NextResponse.json({ ok: true, budget_remaining: newBudget, free_transfers: newFreeTransfers, point_cost: pointCost });
}
