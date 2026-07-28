import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Use this in Server Components, Server Actions, and Route Handlers.
 * Respects the signed-in user's session via cookies, so RLS policies
 * apply exactly as they would for that user.
 */
export function createClient() {
  const cookieStore = cookies();

  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options: any }[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component without a mutable response —
          // safe to ignore because middleware refreshes the session.
        }
      },
    },
  });
}

/**
 * Admin-privileged client using the service role key. NEVER import this
 * into any client-side code. Use only inside Route Handlers for actions
 * that must bypass RLS (e.g. recalculating points across all teams,
 * looking up a league by invite code before the user has joined it).
 */
export function createServiceClient() {
  const { createClient: createSupabaseClient } = require("@supabase/supabase-js");
  return createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
