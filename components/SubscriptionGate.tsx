"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useSubscription } from "@/hooks/useSubscription";

type SubscriptionGateProps = {
  children: ReactNode;
};

export function SubscriptionGate({ children }: SubscriptionGateProps) {
  const { hasAccess, isLoading } = useSubscription();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin w-6 h-6 border-2 border-foreground/40 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50/60 dark:border-amber-900/30 dark:bg-amber-900/10 p-10 text-center">
        <p className="text-[10px] font-mono uppercase tracking-widest text-amber-700 dark:text-amber-200">
          Upgrade required
        </p>
        <h2 className="mt-3 text-xl font-semibold tracking-tight text-foreground">
          Upgrade to GitPulse Pro
        </h2>
        <p className="mt-2 text-sm text-foreground-muted">
          Unlock reports, citations, and team-ready insights.
        </p>
        <Link
          href="/pricing"
          className="mt-6 inline-flex items-center justify-center rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90 transition-opacity"
        >
          View Pricing
        </Link>
      </div>
    );
  }

  return <>{children}</>;
}
