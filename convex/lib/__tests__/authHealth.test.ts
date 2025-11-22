/**
 * Auth Health Integration Tests
 *
 * Verifies Clerk + Convex authentication integration
 */

import { checkHandler, getCurrentIdentityHandler } from "../authHealth";
import * as loggerModule from "../logger";

// Mock logger to prevent test output noise
jest.spyOn(loggerModule.logger, "warn").mockImplementation(() => {});
jest.spyOn(loggerModule.logger, "info").mockImplementation(() => {});

// Helper to create mock context with identity value
function createMockCtx(identityValue: any) {
  return {
    auth: {
      getUserIdentity: jest.fn().mockResolvedValue(identityValue),
    },
  };
}

describe("Auth Health Check", () => {
  describe("check() - authentication status", () => {
    it("should return authenticated status for valid JWT", async () => {
      const mockCtx = {
        auth: {
          getUserIdentity: jest.fn().mockResolvedValue({
            subject: "user_123abc",
            issuer: "https://clerk.example.com",
            tokenIdentifier: "clerk|user_123abc",
            name: "Test User",
            email: "test@example.com",
            emailVerified: true,
          }),
        },
      };

      const result = await checkHandler(mockCtx as any);

      expect(result.isAuthenticated).toBe(true);
      expect(result.userId).toBe("user_123abc");
      expect(result.issuer).toBe("https://clerk.example.com");
      expect(result.tokenIdentifier).toBe("clerk|user_123abc");
      expect(result.email).toBe("test@example.com");
      expect(result.name).toBe("Test User");
      expect(result.message).toBe("Authentication working correctly");
      expect(result.timestamp).toBeGreaterThan(0);
      expect(mockCtx.auth.getUserIdentity).toHaveBeenCalledTimes(1);
    });

    it("should return unauthenticated status when no JWT present", async () => {
      const mockCtx = {
        auth: {
          getUserIdentity: jest.fn().mockResolvedValue(null),
        },
      };

      const result = await checkHandler(mockCtx as any);

      expect(result.isAuthenticated).toBe(false);
      expect(result.userId).toBeNull();
      expect(result.issuer).toBeNull();
      expect(result.tokenIdentifier).toBeNull();
      expect(result.message).toContain("Not authenticated");
      expect(result.setupGuide).toContain("CLERK_JWT_SETUP.md");
      expect(result.timestamp).toBeGreaterThan(0);
      expect(mockCtx.auth.getUserIdentity).toHaveBeenCalledTimes(1);
    });

    it("should handle JWT with minimal claims", async () => {
      const mockCtx = {
        auth: {
          getUserIdentity: jest.fn().mockResolvedValue({
            subject: "user_minimal",
            issuer: "https://clerk.example.com",
            tokenIdentifier: "clerk|user_minimal",
            // Missing optional fields: name, email, emailVerified
          }),
        },
      };

      const result = await checkHandler(mockCtx as any);

      expect(result.isAuthenticated).toBe(true);
      expect(result.userId).toBe("user_minimal");
      expect(result.name).toBeUndefined();
      expect(result.email).toBeUndefined();
    });

    it("should log warning when authentication fails", async () => {
      const warnSpy = jest.spyOn(loggerModule.logger, "warn");
      const mockCtx = {
        auth: {
          getUserIdentity: jest.fn().mockResolvedValue(null),
        },
      };

      await checkHandler(mockCtx as any);

      expect(warnSpy).toHaveBeenCalledWith(
        "No authentication detected - JWT template may not be configured",
      );
    });

    it("should log info when authentication succeeds", async () => {
      const infoSpy = jest.spyOn(loggerModule.logger, "info");
      const mockCtx = {
        auth: {
          getUserIdentity: jest.fn().mockResolvedValue({
            subject: "user_456",
            issuer: "https://clerk.example.com",
            tokenIdentifier: "clerk|user_456",
          }),
        },
      };

      await checkHandler(mockCtx as any);

      expect(infoSpy).toHaveBeenCalledWith(
        { userId: "user_456" },
        "User authenticated",
      );
    });
  });

  describe("getCurrentIdentity() - full identity retrieval", () => {
    it("should return full identity object for authenticated user", async () => {
      const mockIdentity = {
        subject: "user_full_123",
        issuer: "https://clerk.example.com",
        tokenIdentifier: "clerk|user_full_123",
        name: "Jane Doe",
        email: "jane@example.com",
        emailVerified: true,
        givenName: "Jane",
        familyName: "Doe",
        pictureUrl: "https://example.com/avatar.jpg",
        customClaim: "extra_data",
      };

      const mockCtx = {
        auth: {
          getUserIdentity: jest.fn().mockResolvedValue(mockIdentity),
        },
      };

      const result = await getCurrentIdentityHandler(mockCtx as any);

      expect(result).toBeDefined();
      expect(result?.subject).toBe("user_full_123");
      expect(result?.name).toBe("Jane Doe");
      expect(result?.email).toBe("jane@example.com");
      expect(result?.emailVerified).toBe(true);
      expect(result?.givenName).toBe("Jane");
      expect(result?.familyName).toBe("Doe");
      expect(result?.pictureUrl).toBe("https://example.com/avatar.jpg");
      expect(result?.raw).toEqual(mockIdentity);
      expect(mockCtx.auth.getUserIdentity).toHaveBeenCalledTimes(1);
    });

    it("should return null when not authenticated", async () => {
      const mockCtx = {
        auth: {
          getUserIdentity: jest.fn().mockResolvedValue(null),
        },
      };

      const result = await getCurrentIdentityHandler(mockCtx as any);

      expect(result).toBeNull();
      expect(mockCtx.auth.getUserIdentity).toHaveBeenCalledTimes(1);
    });

    it("should include raw identity for debugging", async () => {
      const mockIdentity = {
        subject: "user_debug",
        issuer: "https://clerk.example.com",
        tokenIdentifier: "clerk|user_debug",
        internalField: "debug_data",
      };

      const mockCtx = {
        auth: {
          getUserIdentity: jest.fn().mockResolvedValue(mockIdentity),
        },
      };

      const result = await getCurrentIdentityHandler(mockCtx as any);

      expect(result?.raw).toEqual(mockIdentity);
      expect(result?.raw).toHaveProperty("internalField");
    });

    it("should log info with userId when authenticated", async () => {
      const infoSpy = jest.spyOn(loggerModule.logger, "info");
      const mockCtx = {
        auth: {
          getUserIdentity: jest.fn().mockResolvedValue({
            subject: "user_log_test",
            issuer: "https://clerk.example.com",
            tokenIdentifier: "clerk|user_log_test",
          }),
        },
      };

      await getCurrentIdentityHandler(mockCtx as any);

      expect(infoSpy).toHaveBeenCalledWith(
        { userId: "user_log_test" },
        "getCurrentIdentity",
      );
    });

    it("should log info when not authenticated", async () => {
      const infoSpy = jest.spyOn(loggerModule.logger, "info");
      const mockCtx = {
        auth: {
          getUserIdentity: jest.fn().mockResolvedValue(null),
        },
      };

      await getCurrentIdentityHandler(mockCtx as any);

      expect(infoSpy).toHaveBeenCalledWith(
        "getCurrentIdentity: Not authenticated",
      );
    });
  });

  describe("edge cases and error scenarios", () => {
    it("should handle getUserIdentity throwing error", async () => {
      const mockCtx = {
        auth: {
          getUserIdentity: jest
            .fn()
            .mockRejectedValue(new Error("JWT validation failed")),
        },
      };

      await expect(checkHandler(mockCtx as any)).rejects.toThrow(
        "JWT validation failed",
      );
    });

    it("should handle malformed identity object (missing subject)", async () => {
      const mockCtx = {
        auth: {
          getUserIdentity: jest.fn().mockResolvedValue({
            // Missing required 'subject' field
            issuer: "https://clerk.example.com",
            tokenIdentifier: "clerk|incomplete",
          }),
        },
      };

      const result = await checkHandler(mockCtx as any);

      expect(result.isAuthenticated).toBe(true);
      expect(result.userId).toBeUndefined();
    });

    it("should handle identity with empty subject", async () => {
      const mockCtx = {
        auth: {
          getUserIdentity: jest.fn().mockResolvedValue({
            subject: "",
            issuer: "https://clerk.example.com",
            tokenIdentifier: "clerk|empty",
          }),
        },
      };

      const result = await checkHandler(mockCtx as any);

      expect(result.isAuthenticated).toBe(true);
      expect(result.userId).toBe("");
    });

    it("should handle very long user IDs", async () => {
      const longUserId = "user_" + "a".repeat(1000);
      const mockCtx = {
        auth: {
          getUserIdentity: jest.fn().mockResolvedValue({
            subject: longUserId,
            issuer: "https://clerk.example.com",
            tokenIdentifier: `clerk|${longUserId}`,
          }),
        },
      };

      const result = await checkHandler(mockCtx as any);

      expect(result.isAuthenticated).toBe(true);
      expect(result.userId).toBe(longUserId);
      expect(result.userId?.length).toBe(1005);
    });
  });
});
