"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ADMIN_LINKS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/teams", label: "Teams" },
  { href: "/admin/players", label: "Players" },
  { href: "/admin/fixtures", label: "Fixtures" },
  { href: "/admin/results", label: "Enter Results" },
  { href: "/admin/gameweeks", label: "Gameweeks" },
];

export default function AdminNav() {
  const pathname = usePathname();

  return (
    <>
      {/* Mobile: horizontal scrollable pills, no fixed sidebar taking up screen space */}
      <nav className="mb-4 flex gap-2 overflow-x-auto pb-1 sm:hidden [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {ADMIN_LINKS.map((l) => {
          const active = pathname === l.href;
          return (
            <Link
              key={l.href}
              href={l.href}
              className={`shrink-0 whitespace-nowrap rounded-full border px-3.5 py-1.5 text-sm font-semibold ${
                active ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-400" : "border-pitch-border bg-pitch-surface text-slate-500"
              }`}
            >
              {l.label}
            </Link>
          );
        })}
      </nav>

      {/* Desktop: sidebar */}
      <aside className="hidden w-48 shrink-0 sm:block">
        <h2 className="font-display text-lg font-bold text-slate-900">Admin</h2>
        <nav className="mt-4 flex flex-col gap-1">
          {ADMIN_LINKS.map((l) => {
            const active = pathname === l.href;
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`rounded-lg px-3 py-2 text-sm font-medium ${active ? "bg-pitch-surface text-slate-900" : "text-slate-500 hover:bg-pitch-surface hover:text-slate-900"}`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
