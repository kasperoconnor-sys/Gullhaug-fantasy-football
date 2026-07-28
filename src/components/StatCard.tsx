export default function StatCard({
  label,
  value,
  accent = "violet",
}: {
  label: string;
  value: string | number;
  accent?: "violet" | "emerald";
}) {
  const color = accent === "violet" ? "text-violet-400" : "text-emerald-400";
  return (
    <div className="rounded-xl border border-pitch-border bg-pitch-surface px-4 py-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`font-mono text-xl font-black ${color}`}>{value}</div>
    </div>
  );
}
