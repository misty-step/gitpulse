"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuthenticatedConvexUser } from "@/hooks/useAuthenticatedConvexUser";

/**
 * OnboardingGuard - Redirects to /onboarding if user hasn't completed setup
 *
 * IMPORTANT: Renders children unconditionally to maintain stable hook order.
 * Uses CSS overlay for loading states instead of conditional rendering.
 * This prevents React "hooks count changed" errors during auth transitions.
 */
export function OnboardingGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { convexUser, isLoading } = useAuthenticatedConvexUser();

  // Handle redirect in useEffect (separate from render logic)
  useEffect(() => {
    // Skip redirect if already on onboarding page
    if (pathname === "/onboarding") {
      return;
    }

    // Redirect to onboarding if loaded and (NO user record OR onboarding incomplete)
    if (!isLoading && (!convexUser || !convexUser.onboardingCompleted)) {
      router.push("/onboarding");
    }
  }, [convexUser, isLoading, router, pathname]);

  // Determine if we should show loading overlay
  const showLoading = isLoading || !convexUser || !convexUser.onboardingCompleted;

  // ALWAYS render children to maintain stable component tree and hook order
  // Show loading overlay when needed, but children remain mounted
  return (
    <div className="relative">
      {showLoading && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-gray-50 min-h-screen">
          <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full" />
        </div>
      )}
      {/* Children always render to maintain hook stability */}
      <div className={showLoading ? "invisible" : ""}>
        {children}
      </div>
    </div>
  );
}
