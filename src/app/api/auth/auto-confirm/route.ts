import { createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * Auto-confirms a freshly created user's email address using the
 * service role (admin) client. This lets a small club app skip the
 * "check your email" step entirely — signup can log the manager in
 * immediately instead of waiting on a confirmation link.
 */
export async function POST(request: Request) {
  const { user_id } = (await request.json()) as { user_id: string };
  if (!user_id) return NextResponse.json({ error: "Missing user_id." }, { status: 400 });

  const db = createServiceClient();
  const { error } = await db.auth.admin.updateUserById(user_id, { email_confirm: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
