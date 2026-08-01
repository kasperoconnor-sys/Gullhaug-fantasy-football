export default function StatCard({
  label,
  value,
}: {
  label: string;
  value: string | number;
  accent?: "violet" | "emerald" | "gold" | "red";
}) {
  return (
    <div className="card-premium rounded-xl px-4 py-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="font-mono text-xl font-black tabular-nums text-slate-900">{value}</div>
    </div>
  );
}
