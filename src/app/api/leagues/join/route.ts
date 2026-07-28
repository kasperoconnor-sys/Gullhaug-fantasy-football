import { createClient, createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabase = createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return NextResponse.json({ error: "Ikke innlogget." }, { status: 401 });

  const { fantasy_team_id, invite_code } = (await request.json()) as { fantasy_team_id: string; invite_code: string };

  const { data: team } = await supabase.from("fantasy_teams").select("*").eq("id", fantasy_team_id).single();
  if (!team || team.user_id !== userData.user.id) {
    return NextResponse.json({ error: "Fant ikke laget ditt." }, { status: 403 });
  }

  const serviceClient = createServiceClient();
  const { data: league } = await serviceClient.from("fantasy_leagues").select("*").eq("invite_code", invite_code).maybeSingle();
  if (!league) return NextResponse.json({ error: "Fant ingen liga med denne koden." }, { status: 404 });

  const { error } = await supabase.from("league_members").insert({ league_id: league.id, fantasy_team_id });
  if (error) {
    if (error.code === "23505") return NextResponse.json({ error: "Du er allerede med i denne ligaen." }, { status: 400 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, league });
}
