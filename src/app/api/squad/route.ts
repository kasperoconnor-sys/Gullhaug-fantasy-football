import { createClient } from "@/lib/supabase/server";
import { validateSquad } from "@/lib/squadRules";
import { Player } from "@/types";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabase = createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return NextResponse.json({ error: "Not logged in." }, { status: 401 });

  const { fantasy_team_id, player_ids } = (await request.json()) as {
    fantasy_team_id: string;
    player_ids: string[];
  };

  // Confirm the fantasy team belongs to the caller (defense in depth; RLS also enforces this).
  const { data: team } = await supabase.from("fantasy_teams").select("*").eq("id", fantasy_team_id).single();
  if (!team || team.user_id !== userData.user.id) {
    return NextResponse.json({ error: "Couldn't find your team." }, { status: 403 });
  }

  const [{ data: settings }, { data: playerRows }, { data: gullhaugTeams }] = await Promise.all([
    supabase.from("season_settings").select("*").single(),
    supabase.from("players").select("*, team:teams(*)").in("id", player_ids),
    supabase.from("teams").select("id, name").eq("is_gullhaug", true),
  ]);

  const players = (playerRows ?? []) as Player[];
  const g1 = gullhaugTeams?.find((t) => t.name.includes("1"))?.id ?? gullhaugTeams?.[0]?.id ?? "";
  const g2 = gullhaugTeams?.find((t) => t.name.includes("2"))?.id ?? gullhaugTeams?.[1]?.id ?? "";

  const result = validateSquad(players, settings?.starting_budget ?? 100, {
    maxPerTeam: settings?.max_players_per_team ?? 4,
    minGullhaug1: settings?.min_gullhaug_1 ?? 2,
    minGullhaug2: settings?.min_gullhaug_2 ?? 2,
    gullhaug1Id: g1,
    gullhaug2Id: g2,
  });

  if (!result.valid) {
    return NextResponse.json({ error: result.errors[0], errors: result.errors }, { status: 400 });
  }

  // Replace the existing squad wholesale. Prices are locked at purchase time.
  await supabase.from("fantasy_squad_players").delete().eq("fantasy_team_id", fantasy_team_id);

  const rows = players.map((p) => ({
    fantasy_team_id,
    player_id: p.id,
    purchase_price: p.price,
  }));
  const { error: insertError } = await supabase.from("fantasy_squad_players").insert(rows);
  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

  const spent = players.reduce((sum, p) => sum + p.price, 0);
  const budgetRemaining = Math.round(((settings?.starting_budget ?? 100) - spent) * 10) / 10;
  await supabase.from("fantasy_teams").update({ budget_remaining: budgetRemaining }).eq("id", fantasy_team_id);

  return NextResponse.json({ ok: true, budget_remaining: budgetRemaining });
}
