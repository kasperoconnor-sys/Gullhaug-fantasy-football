"use client";

import { useEffect, useState } from "react";
import { Clock } from "lucide-react";

export default function DeadlineCountdown({ deadline, gameweekNumber }: { deadline: string; gameweekNumber: number }) {
  const [remaining, setRemaining] = useState<{ days: number; hours: number; minutes: number } | null>(null);

  useEffect(() => {
    function tick() {
      const diff = new Date(deadline).getTime() - Date.now();
      if (diff <= 0) {
        setRemaining(null);
        return;
      }
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
      const minutes = Math.floor((diff / (1000 * 60)) % 60);
      setRemaining({ days, hours, minutes });
    }
    tick();
    const id = setInterval(tick, 60000);
    return () => clearInterval(id);
  }, [deadline]);

  if (!remaining) return null;

  return (
    <div className="rounded-2xl border border-slate-300 bg-gradient-to-br from-slate-100 to-emerald-600/10 p-4">
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-600">
        <Clock size={14} />
        Next deadline — Gameweek {gameweekNumber}
      </div>
      <div className="mt-2 flex gap-4">
        <TimeBlock value={remaining.days} label="Days" />
        <TimeBlock value={remaining.hours} label="Hours" />
        <TimeBlock value={remaining.minutes} label="Minutes" />
      </div>
    </div>
  );
}

function TimeBlock({ value, label }: { value: number; label: string }) {
  return (
    <div>
      <div className="font-mono text-3xl font-black text-slate-900">{value}</div>
      <div className="text-[11px] text-slate-500">{label}</div>
    </div>
  );
}
