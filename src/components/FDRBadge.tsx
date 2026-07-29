const LABELS: Record<number, string> = {
  1: "Very easy",
  2: "Easy",
  3: "Average",
  4: "Difficult",
  5: "Very difficult",
};

export default function FDRBadge({ rating, showLabel = false }: { rating: number; showLabel?: boolean }) {
  return (
    <span
      className={`fdr-${rating} inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-bold`}
      title={LABELS[rating]}
    >
      {rating}
      {showLabel && <span className="font-normal">{LABELS[rating]}</span>}
    </span>
  );
}
