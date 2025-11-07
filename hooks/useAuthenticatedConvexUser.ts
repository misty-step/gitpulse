"use client";

import { useUser } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

/**
 * Deep module that handles Clerk + Convex user loading choreography.
 *
 * Hides complexity of:
 * - Clerk authentication loading state
 * - Convex query skipping when auth not ready
 * - Edge cases around unauthenticated users
 * - Async loading coordination between two systems
 *
 * Simple interface exposes only what callers need.
 */
export function useAuthenticatedConvexUser() {
  const { user: clerkUser, isLoaded: isClerkLoaded } = useUser();

  // Only query Convex if Clerk is loaded and user exists
  // Query with "skip" returns undefined forever - we avoid that by checking isClerkLoaded first
  const convexUser = useQuery(
    api.users.getByClerkId,
    isClerkLoaded && clerkUser?.id ? { clerkId: clerkUser.id } : "skip"
  );

  // Loading: Either Clerk hasn't loaded yet, OR Clerk loaded with user but Convex query pending
  const isLoading = !isClerkLoaded || (clerkUser?.id && convexUser === undefined);

  // Authenticated: Clerk has loaded and user exists (even if Convex user not found yet)
  const isAuthenticated = isClerkLoaded && !!clerkUser;

  return {
    /** Clerk user object (includes id, email, etc.) */
    clerkUser,
    /** Convex user object (includes githubUsername, settings, etc.) - undefined if loading or not found */
    convexUser,
    /** True while waiting for Clerk or Convex to load */
    isLoading,
    /** True if Clerk loaded and user is authenticated */
    isAuthenticated,
  };
}
