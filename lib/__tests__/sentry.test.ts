import { afterEach, describe, expect, it } from "@jest/globals";
import { getSentryEnvironment, scrubPii } from "@/lib/sentry";

const ORIGINAL_VERCEL_ENV = process.env.VERCEL_ENV;
const ORIGINAL_NODE_ENV = process.env.NODE_ENV;

function restoreEnv() {
  if (ORIGINAL_VERCEL_ENV === undefined) {
    delete process.env.VERCEL_ENV;
  } else {
    process.env.VERCEL_ENV = ORIGINAL_VERCEL_ENV;
  }

  if (ORIGINAL_NODE_ENV === undefined) {
    Object.defineProperty(process.env, "NODE_ENV", {
      value: undefined,
      writable: true,
      configurable: true,
    });
  } else {
    Object.defineProperty(process.env, "NODE_ENV", {
      value: ORIGINAL_NODE_ENV,
      writable: true,
      configurable: true,
    });
  }
}

afterEach(() => {
  restoreEnv();
});

describe("scrubPii", () => {
  it("removes user.email when present", () => {
    const event: Parameters<typeof scrubPii>[0] = {
      type: undefined,
      user: { id: "u_1", email: "alice@example.com" },
    };

    const result = scrubPii(event);

    expect(result).not.toBeNull();
    expect(event.user?.email).toBeUndefined();
  });

  it("removes user.ip_address when present", () => {
    const event: Parameters<typeof scrubPii>[0] = {
      type: undefined,
      user: { id: "u_1", ip_address: "127.0.0.1" },
    };

    scrubPii(event);

    expect(event.user?.ip_address).toBeUndefined();
  });

  it("removes sensitive fields from extras", () => {
    const event: Parameters<typeof scrubPii>[0] = {
      type: undefined,
      extra: {
        password: "secret",
        accessToken: "access",
        refreshToken: "refresh",
        token: "token",
        safeValue: "ok",
      },
    };

    scrubPii(event);

    expect(event.extra?.password).toBeUndefined();
    expect(event.extra?.accessToken).toBeUndefined();
    expect(event.extra?.refreshToken).toBeUndefined();
    expect(event.extra?.token).toBeUndefined();
    expect(event.extra?.safeValue).toBe("ok");
  });

  it("preserves other user fields", () => {
    const event: Parameters<typeof scrubPii>[0] = {
      type: undefined,
      user: {
        id: "u_1",
        username: "alice",
        email: "alice@example.com",
        ip_address: "127.0.0.1",
      },
    };

    scrubPii(event);

    expect(event.user).toMatchObject({
      id: "u_1",
      username: "alice",
    });
    expect(event.user?.email).toBeUndefined();
    expect(event.user?.ip_address).toBeUndefined();
  });

  it("preserves non-sensitive extras", () => {
    const event: Parameters<typeof scrubPii>[0] = {
      type: undefined,
      extra: {
        featureFlag: true,
        attempts: 3,
      },
    };

    scrubPii(event);

    expect(event.extra).toMatchObject({
      featureFlag: true,
      attempts: 3,
    });
  });

  it("handles events with no user", () => {
    const event: Parameters<typeof scrubPii>[0] = {
      type: undefined,
      extra: { attempts: 1 },
    };

    const result = scrubPii(event);

    expect(result).toBe(event);
    expect(event.extra?.attempts).toBe(1);
  });

  it("handles events with no extras", () => {
    const event: Parameters<typeof scrubPii>[0] = {
      type: undefined,
      user: { id: "u_1", email: "alice@example.com" },
    };

    const result = scrubPii(event);

    expect(result).toBe(event);
    expect(event.user?.email).toBeUndefined();
  });

  it("returns the modified event (never null)", () => {
    const event: Parameters<typeof scrubPii>[0] = {
      type: undefined,
      user: { id: "u_1", email: "alice@example.com" },
      extra: { password: "secret" },
    };

    const result = scrubPii(event);

    expect(result).toBe(event);
    expect(result).not.toBeNull();
  });
});

describe("getSentryEnvironment", () => {
  it("returns VERCEL_ENV when set", () => {
    process.env.VERCEL_ENV = "preview";
    Object.defineProperty(process.env, "NODE_ENV", {
      value: "production",
      writable: true,
      configurable: true,
    });

    expect(getSentryEnvironment()).toBe("preview");
  });

  it("returns NODE_ENV when VERCEL_ENV is not set", () => {
    delete process.env.VERCEL_ENV;
    Object.defineProperty(process.env, "NODE_ENV", {
      value: "test",
      writable: true,
      configurable: true,
    });

    expect(getSentryEnvironment()).toBe("test");
  });

  it('returns "development" when neither env var is set', () => {
    delete process.env.VERCEL_ENV;
    Object.defineProperty(process.env, "NODE_ENV", {
      value: undefined,
      writable: true,
      configurable: true,
    });

    expect(getSentryEnvironment()).toBe("development");
  });
});
