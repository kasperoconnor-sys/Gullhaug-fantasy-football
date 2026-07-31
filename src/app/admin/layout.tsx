import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import AdminNav from "@/components/AdminNav";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("is_admin").eq("id", userData.user.id).single();
  if (!profile?.is_admin) redirect("/");

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="sm:flex sm:gap-6">
        <AdminNav />
        <div className="flex-1">{children}</div>
      </div>
    </div>
  );
}
