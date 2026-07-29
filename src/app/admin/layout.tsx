import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";

const ADMIN_LINKS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/teams", label: "Teams" },
  { href: "/admin/players", label: "Players" },
  { href: "/admin/fixtures", label: "Fixtures" },
  { href: "/admin/results", label: "Enter Results" },
  { href: "/admin/gameweeks", label: "Gameweeks" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("is_admin").eq("id", userData.user.id).single();
  if (!profile?.is_admin) redirect("/");

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="flex gap-6">
        <aside className="w-48 shrink-0">
          <h2 className="font-display text-lg font-bold text-white">Admin</h2>
          <nav className="mt-4 flex flex-col gap-1">
            {ADMIN_LINKS.map((l) => (
              <Link key={l.href} href={l.href} className="rounded-lg px-3 py-2 text-sm font-medium text-slate-400 hover:bg-pitch-surface hover:text-white">
                {l.label}
              </Link>
            ))}
          </nav>
        </aside>
        <div className="flex-1">{children}</div>
      </div>
    </div>
  );
}
