import clsx from "clsx";

interface CoverageMeterProps {
  score?: number | null;
  threshold?: number;
  label?: string;
}

export function CoverageMeter({
  score,
  threshold = 0.7,
  label = "Coverage",
}: CoverageMeterProps) {
  const percentage =
    typeof score === "number" && !Number.isNaN(score)
      ? Math.round(score * 100)
      : null;

  const status =
    percentage === null
      ? "unknown"
      : percentage / 100 >= threshold
      ? "good"
      : "warning";

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs uppercase tracking-wide text-gray-500 dark:text-slate-400">
        <span>{label}</span>
        <span>
          {percentage === null ? "N/A" : `${percentage}%`}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-neutral-800">
        <div
          className={clsx(
            "h-full rounded-full transition-all",
            status === "good"
              ? "bg-emerald-500"
              : status === "warning"
              ? "bg-amber-500"
              : "bg-gray-400 dark:bg-neutral-600"
          )}
          style={{ width: `${Math.min(Math.max(percentage ?? 0, 0), 100)}%` }}
        />
      </div>
      {status === "warning" && (
        <p className="text-xs text-amber-600 dark:text-amber-400">
          Needs more citations & coverage (target ≥ {Math.round(threshold * 100)}%)
        </p>
      )}
    </div>
  );
}
