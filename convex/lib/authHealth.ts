/**
 * Auth Health Check - Verify authentication is working
 *
 * Provides diagnostic endpoints to verify Clerk + Convex integration
 */

import { query } from "../_generated/server";
import { logger } from "./logger.js";

/**
 * Check authentication health
 *
 * Returns detailed auth state for debugging:
 * - Is user authenticated?
 * - User ID (if authenticated)
 * - Issuer domain
 * - Token identifier
 * - Timestamp
 *
 * Usage:
 * ```typescript
 * const health = useQuery(api.lib.authHealth.check);
 * console.log('Auth status:', health);
 * ```
 */
export const check = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();

    if (!identity) {
      logger.warn(
        "No authentication detected - JWT template may not be configured",
      );
      return {
        isAuthenticated: false,
        userId: null,
        issuer: null,
        tokenIdentifier: null,
        timestamp: Date.now(),
        message:
          "Not authenticated - JWT template may not be configured in Clerk",
        setupGuide: "See CLERK_JWT_SETUP.md for configuration instructions",
      };
    }

    logger.info({ userId: identity.subject }, "User authenticated");
    return {
      isAuthenticated: true,
      userId: identity.subject,
      issuer: identity.issuer,
      tokenIdentifier: identity.tokenIdentifier,
      name: identity.name,
      email: identity.email,
      timestamp: Date.now(),
      message: "Authentication working correctly",
    };
  },
});

/**
 * Get current user's Clerk identity
 *
 * Returns full Clerk user identity object for debugging
 * Returns null if not authenticated
 */
export const getCurrentIdentity = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();

    if (!identity) {
      logger.info("getCurrentIdentity: Not authenticated");
      return null;
    }

    logger.info({ userId: identity.subject }, "getCurrentIdentity");

    // Return full identity for debugging
    return {
      subject: identity.subject,
      issuer: identity.issuer,
      tokenIdentifier: identity.tokenIdentifier,
      name: identity.name,
      email: identity.email,
      emailVerified: identity.emailVerified,
      givenName: identity.givenName,
      familyName: identity.familyName,
      pictureUrl: identity.pictureUrl,
      // Full object for advanced debugging
      raw: identity,
    };
  },
});
