"use client";

type WelcomeReportStatus =
  | "pending"
  | "generating"
  | "completed"
  | "failed"
  | undefined;

type WelcomeReportCardProps = {
  status: WelcomeReportStatus;
  onRetry?: () => void;
};

export function WelcomeReportCard({ status, onRetry }: WelcomeReportCardProps) {
  if (!status || status === "completed") {
    return null;
  }

  const isGenerating = status === "generating";
  const isPending = status === "pending";
  const isFailed = status === "failed";

  return (
    <div className="rounded-xl border border-border bg-surface p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <span className="text-[10px] font-mono uppercase tracking-wider text-muted">
            First report
          </span>
          {isPending && (
            <p className="mt-2 text-sm text-foreground">
              Setting up your reports...
            </p>
          )}
          {isGenerating && (
            <p className="mt-2 text-sm text-foreground">
              Generating your first report...
            </p>
          )}
          {isFailed && (
            <p className="mt-2 text-sm text-foreground">
              Unable to generate report. Try again.
            </p>
          )}
        </div>
        {isGenerating && (
          <span className="h-4 w-4 rounded-full border-2 border-foreground/40 border-t-transparent animate-spin" />
        )}
      </div>

      {isFailed && onRetry && (
        <div className="mt-4">
          <button
            type="button"
            onClick={onRetry}
            className="px-3 py-1.5 text-xs font-medium rounded-lg border border-border hover:bg-surface-muted transition-colors"
          >
            Retry
          </button>
        </div>
      )}
    </div>
  );
}
