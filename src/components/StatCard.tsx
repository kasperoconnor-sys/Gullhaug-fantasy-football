export default function StatCard({
  label,
  value,
  accent = "violet",
}: {
  label: string;
  value: string | number;
  accent?: "violet" | "emerald" | "gold" | "red";
}) {
  const textColor = {
    violet: "text-violet-700",
    emerald: "text-emerald-700",
    gold: "text-amber-700",
    red: "text-rose-700",
  }[accent];

  return (
    <div className="card-premium rounded-xl px-4 py-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`font-mono text-xl font-black tabular-nums ${textColor}`}>{value}</div>
    </div>
  );
}
