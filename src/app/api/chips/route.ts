import { createClient } from "@/lib/supabase/server";
import { ChipType } from "@/types";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabase = createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return NextResponse.json({ error: "Ikke innlogget." }, { status: 401 });

  const { fantasy_team_id, gameweek_id, chip } = (await request.json()) as {
    fantasy_team_id: string;
    gameweek_id: string;
    chip: ChipType;
  };

  const { data: team } = await supabase.from("fantasy_teams").select("*").eq("id", fantasy_team_id).single();
  if (!team || team.user_id !== userData.user.id) {
    return NextResponse.json({ error: "Fant ikke laget ditt." }, { status: 403 });
  }

  const { data: existingUsage } = await supabase
    .from("chip_usages")
    .select("id")
    .eq("fantasy_team_id", fantasy_team_id)
    .eq("chip", chip)
    .maybeSingle();
  if (existingUsage) {
    return NextResponse.json({ error: "Denne chippen er allerede brukt denne sesongen." }, { status: 400 });
  }

  const { data: activeThisGw } = await supabase
    .from("gameweek_lineups")
    .select("id")
    .eq("fantasy_team_id", fantasy_team_id)
    .eq("gameweek_id", gameweek_id)
    .not("active_chip", "is", null)
    .maybeSingle();
  if (activeThisGw) {
    return NextResponse.json({ error: "Du har allerede en chip aktiv denne runden." }, { status: 400 });
  }

  const { error: usageError } = await supabase.from("chip_usages").insert({ fantasy_team_id, chip, gameweek_id });
  if (usageError) return NextResponse.json({ error: usageError.message }, { status: 500 });

  if (chip === "wildcard") {
    // Wildcard grants unlimited free transfers for the gameweek — handled
    // by temporarily lifting the paid-transfer check rather than a real
    // budget change. Simplest robust approach: bump free_transfers high
    // and let the season rollover cap re-normalize it after the gameweek.
    await supabase.from("fantasy_teams").update({ free_transfers: 99 }).eq("id", fantasy_team_id);
  } else {
    await supabase
      .from("gameweek_lineups")
      .upsert({ fantasy_team_id, gameweek_id, active_chip: chip, formation: "4-4-2" }, { onConflict: "fantasy_team_id,gameweek_id", ignoreDuplicates: false });
    await supabase.from("gameweek_lineups").update({ active_chip: chip }).eq("fantasy_team_id", fantasy_team_id).eq("gameweek_id", gameweek_id);
  }

  return NextResponse.json({ ok: true });
}
