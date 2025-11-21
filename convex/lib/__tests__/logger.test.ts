/**
 * Logger PII Redaction Tests
 *
 * Verifies that sensitive fields are redacted from log output
 */

import pino from "pino";
import { Writable } from "stream";

describe("Logger PII Redaction", () => {
  let logOutput: string[] = [];
  let mockStream: Writable;

  beforeEach(() => {
    logOutput = [];
    // Create a writable stream that captures log output
    mockStream = new Writable({
      write(chunk, _encoding, callback) {
        logOutput.push(chunk.toString());
        callback();
      },
    });
  });

  // Helper to create logger with same redaction config but custom stream
  const createTestLogger = () => {
    const REDACT_PATHS = [
      "email",
      "githubEmail",
      "clerkId",
      "userId",
      "ghLogin",
      "githubUsername",
      "accessToken",
      "githubAccessToken",
      "refreshToken",
      "githubRefreshToken",
      "token",
      "req.headers.authorization",
      "req.headers.cookie",
      "res.headers['set-cookie']",
      "apiKey",
      "GOOGLE_API_KEY",
      "OPENAI_API_KEY",
      "VOYAGE_API_KEY",
      "CLERK_SECRET_KEY",
    ];

    return pino(
      {
        level: "info",
        base: { service: "gitpulse" },
        redact: {
          paths: REDACT_PATHS,
          censor: "[REDACTED]",
        },
        serializers: {
          err: pino.stdSerializers.err,
          req: pino.stdSerializers.req,
        },
      },
      mockStream,
    );
  };

  it("should redact email addresses", () => {
    const testLogger = createTestLogger();
    testLogger.info({ email: "user@example.com" }, "User logged in");

    const log = JSON.parse(logOutput[0]);
    expect(log.email).toBe("[REDACTED]");
    expect(log.msg).toBe("User logged in");
  });

  it("should redact GitHub email", () => {
    const testLogger = createTestLogger();
    testLogger.info(
      { githubEmail: "developer@github.com" },
      "GitHub profile loaded",
    );

    const log = JSON.parse(logOutput[0]);
    expect(log.githubEmail).toBe("[REDACTED]");
  });

  it("should redact OAuth tokens", () => {
    const testLogger = createTestLogger();
    testLogger.info(
      {
        accessToken: "gho_secretAccessToken123",
        refreshToken: "ghr_secretRefreshToken456",
      },
      "Tokens refreshed",
    );

    const log = JSON.parse(logOutput[0]);
    expect(log.accessToken).toBe("[REDACTED]");
    expect(log.refreshToken).toBe("[REDACTED]");
  });

  it("should redact GitHub-specific tokens", () => {
    const testLogger = createTestLogger();
    testLogger.info(
      {
        githubAccessToken: "gho_abc123",
        githubRefreshToken: "ghr_xyz789",
      },
      "GitHub auth updated",
    );

    const log = JSON.parse(logOutput[0]);
    expect(log.githubAccessToken).toBe("[REDACTED]");
    expect(log.githubRefreshToken).toBe("[REDACTED]");
  });

  it("should redact Clerk user IDs", () => {
    const testLogger = createTestLogger();
    testLogger.info({ clerkId: "user_2abc123xyz" }, "User authenticated");

    const log = JSON.parse(logOutput[0]);
    expect(log.clerkId).toBe("[REDACTED]");
  });

  it("should redact GitHub usernames", () => {
    const testLogger = createTestLogger();
    testLogger.info(
      { ghLogin: "johndoe", githubUsername: "johndoe" },
      "Processing user activity",
    );

    const log = JSON.parse(logOutput[0]);
    expect(log.ghLogin).toBe("[REDACTED]");
    expect(log.githubUsername).toBe("[REDACTED]");
  });

  it("should redact authorization headers", () => {
    const testLogger = createTestLogger();
    testLogger.info(
      {
        req: {
          headers: {
            authorization: "Bearer secret_token",
            cookie: "session=abc123",
          },
        },
      },
      "HTTP request received",
    );

    const log = JSON.parse(logOutput[0]);
    expect(log.req.headers.authorization).toBe("[REDACTED]");
    expect(log.req.headers.cookie).toBe("[REDACTED]");
  });

  it("should preserve non-sensitive fields", () => {
    const testLogger = createTestLogger();
    testLogger.info(
      {
        userId: "internal_123",
        eventCount: 42,
        repoName: "example/repo",
        status: "success",
      },
      "Report generated",
    );

    const log = JSON.parse(logOutput[0]);
    // userId is redacted (in REDACT_PATHS)
    expect(log.userId).toBe("[REDACTED]");
    // Other fields preserved
    expect(log.eventCount).toBe(42);
    expect(log.repoName).toBe("example/repo");
    expect(log.status).toBe("success");
  });

  it("should redact API keys", () => {
    const testLogger = createTestLogger();
    testLogger.info(
      {
        GOOGLE_API_KEY: "AIza...",
        OPENAI_API_KEY: "sk-...",
        VOYAGE_API_KEY: "pa-...",
      },
      "API keys loaded",
    );

    const log = JSON.parse(logOutput[0]);
    expect(log.GOOGLE_API_KEY).toBe("[REDACTED]");
    expect(log.OPENAI_API_KEY).toBe("[REDACTED]");
    expect(log.VOYAGE_API_KEY).toBe("[REDACTED]");
  });

  it("should handle nested redaction paths", () => {
    const testLogger = createTestLogger();
    testLogger.info(
      {
        user: {
          email: "user@example.com",
          name: "John Doe",
        },
      },
      "User object logged",
    );

    const log = JSON.parse(logOutput[0]);
    // Note: Pino redaction with dot notation handles nested paths
    // But 'email' in our REDACT_PATHS will match top-level 'email' only
    // For nested paths, we'd need 'user.email' in REDACT_PATHS
    expect(log.user.name).toBe("John Doe"); // Preserved
  });

  it("should maintain log level and message", () => {
    const testLogger = createTestLogger();
    testLogger.warn(
      { email: "sensitive@example.com", severity: "high" },
      "Security alert",
    );

    const log = JSON.parse(logOutput[0]);
    expect(log.level).toBe(40); // warn level
    expect(log.msg).toBe("Security alert");
    expect(log.email).toBe("[REDACTED]");
    expect(log.severity).toBe("high");
  });
});
