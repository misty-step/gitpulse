"use client";

import { useEffect, Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import posthog from "posthog-js";

function PostHogPageviewInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (pathname && typeof window !== "undefined") {
      const search = searchParams?.toString();
      const url = window.origin + pathname + (search ? `?${search}` : "");
      posthog.capture("$pageview", { $current_url: url });
    }
  }, [pathname, searchParams]);

  return null;
}

export function PostHogPageview() {
  return (
    <Suspense fallback={null}>
      <PostHogPageviewInner />
    </Suspense>
  );
}
