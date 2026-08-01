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
    violet: "text-gradient-purple",
    emerald: "text-emerald-400",
    gold: "text-gradient-gold",
    red: "text-rose-400",
  }[accent];

  return (
    <div className="card-premium rounded-xl px-4 py-3 transition-transform duration-150 hover:-translate-y-0.5">
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`font-mono text-xl font-black tabular-nums ${textColor}`}>{value}</div>
    </div>
  );
}
