"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MAIN_NAV } from "./navConfig";

export default function ScrollNav() {
  const pathname = usePathname();

  return (
    <div className="sticky top-[49px] z-30 border-b border-pitch-border bg-pitch/95 backdrop-blur sm:top-[57px]">
      <nav className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-3 py-2 [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {MAIN_NAV.map((item) => {
          const active = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-all duration-150 active:scale-95 ${
                active
                  ? "border-violet-500/40 bg-gradient-to-r from-violet-600/25 to-violet-600/10 text-violet-300 shadow-glow"
                  : "border-transparent text-slate-400 hover:bg-pitch-surface hover:text-white"
              }`}
            >
              <Icon size={15} />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
