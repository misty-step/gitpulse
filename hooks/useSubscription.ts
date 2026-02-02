"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

export function useSubscription() {
  const result = useQuery(api.subscriptions.hasActiveSubscription, {});
  const isLoading = result === undefined;

  return {
    hasAccess: result?.hasAccess ?? false,
    status: result?.status ?? null,
    trialEndsAt: result?.trialEndsAt ?? null,
    isLoading,
  };
}
