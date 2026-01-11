"use client";

import { useEffect } from "react";
import Link from "next/link";
import * as Sentry from "@sentry/nextjs";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Capture error in Sentry
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="min-h-screen bg-surface-muted flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-background rounded-lg shadow-lg p-8 text-center">
        <div className="w-16 h-16 bg-error-muted rounded-full flex items-center justify-center mx-auto mb-4">
          <svg
            className="w-8 h-8 text-error"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>

        <h1 className="text-2xl font-bold text-foreground mb-2">
          Something went wrong
        </h1>

        <p className="text-foreground-muted mb-6">
          We encountered an unexpected error. This has been logged and
          we&apos;ll look into it.
        </p>

        {error.digest && (
          <p className="text-sm text-muted mb-6 font-mono bg-surface-muted p-2 rounded">
            Error ID: {error.digest}
          </p>
        )}

        <div className="space-y-3">
          <button
            onClick={reset}
            className="w-full px-4 py-2 bg-indigo text-white rounded-lg hover:bg-indigo/90 transition-colors font-medium"
          >
            Try Again
          </button>

          <Link
            href="/dashboard"
            className="block w-full px-4 py-2 border border-border text-foreground-muted rounded-lg hover:bg-surface-muted transition-colors font-medium"
          >
            Go to Dashboard
          </Link>

          <Link
            href="/"
            className="block text-sm text-muted hover:text-foreground-muted"
          >
            Return to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
