"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { IntegrationStatus } from "@/lib/integrationStatus";

export function useIntegrationStatus(): {
  status: IntegrationStatus | undefined;
  isLoading: boolean;
} {
  const status = useQuery(api.integrations.getStatus, {});
  return {
    status,
    isLoading: status === undefined,
  };
}
