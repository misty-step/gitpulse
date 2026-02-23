"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";
import posthog from "posthog-js";
import { PostHogProvider as PHProvider } from "posthog-js/react";
import { useUser } from "@clerk/nextjs";

const DEFAULT_POSTHOG_UI_HOST = "https://us.posthog.com";

function deriveUiHost(apiHost: string | undefined): string | undefined {
  if (!apiHost || apiHost.startsWith("/")) {
    return undefined;
  }

  try {
    return new URL(apiHost).origin;
  } catch {
    return undefined;
  }
}

export function PostHogProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    if (typeof window !== "undefined" && process.env.NEXT_PUBLIC_POSTHOG_KEY) {
      const apiHost = process.env.NEXT_PUBLIC_POSTHOG_HOST || "/ingest";

      posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
        api_host: apiHost,
        ui_host:
          process.env.NEXT_PUBLIC_POSTHOG_UI_HOST ||
          deriveUiHost(process.env.NEXT_PUBLIC_POSTHOG_HOST) ||
          DEFAULT_POSTHOG_UI_HOST,
        person_profiles: "identified_only",
        capture_pageview: false, // We'll capture manually for SPA
        capture_pageleave: true,
        respect_dnt: true,
      });
    }
  }, []);

  return <PHProvider client={posthog}>{children}</PHProvider>;
}

// Separate component for user identification
export function PostHogIdentify() {
  const { user, isLoaded } = useUser();

  useEffect(() => {
    if (isLoaded && user) {
      posthog.identify(user.id, {
        // Only include non-PII fields
        created_at: user.createdAt
          ? new Date(user.createdAt).toISOString()
          : undefined,
      });
    } else if (isLoaded && !user && posthog._isIdentified?.()) {
      posthog.reset();
    }
  }, [user, isLoaded]);

  return null;
}
