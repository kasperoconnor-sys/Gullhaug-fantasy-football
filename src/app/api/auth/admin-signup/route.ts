import { createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * Creates a new manager account entirely server-side via the admin API.
 * Unlike the regular client-side signUp(), admin.createUser() never
 * sends a confirmation email — so this sidesteps Supabase's built-in
 * email rate limit entirely, which matters for a small club app that
 * doesn't need email verification.
 */
export async function POST(request: Request) {
  const { email, password, display_name, team_name } = (await request.json()) as {
    email: string;
    password: string;
    display_name: string;
    team_name: string;
  };

  if (!email || !password || !display_name || !team_name) {
    return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
  }

  const db = createServiceClient();
  const { data, error } = await db.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name, team_name },
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true, user_id: data.user?.id });
}
