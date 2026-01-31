"use client";

import type { Doc } from "@/convex/_generated/dataModel";

/**
 * Status of the user's first report generation.
 * Derived from the users table firstReportStatus field.
 */
type WelcomeReportStatus = Doc<"users">["firstReportStatus"];

type WelcomeReportCardProps = {
  status: WelcomeReportStatus;
  onRetry?: () => void;
  isRetrying?: boolean;
};

/**
 * Displays first report generation status on the dashboard.
 *
 * Shows a card with status-appropriate messaging during onboarding:
 * - Pending: "Setting up your reports..."
 * - Generating: Spinner with "Generating your first report..."
 * - Failed: Error message with retry button
 * - Completed/undefined: Returns null (card hidden)
 *
 * @param props.status - Current first report generation status
 * @param props.onRetry - Optional callback to retry failed generation
 * @returns Status card JSX or null if completed/not applicable
 */
export function WelcomeReportCard({
  status,
  onRetry,
  isRetrying = false,
}: WelcomeReportCardProps) {
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
            disabled={isRetrying}
            className="px-3 py-1.5 text-xs font-medium rounded-lg border border-border hover:bg-surface-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Retry
          </button>
        </div>
      )}
    </div>
  );
}
