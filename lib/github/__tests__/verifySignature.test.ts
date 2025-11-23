import { describe, expect, it } from "@jest/globals";
import { createHmac } from "crypto";
import { verifyWebhookSignature } from "../verifySignature";

describe("verifyWebhookSignature", () => {
  const payload = JSON.stringify({ action: "ping" });

  function sign(secret: string): string {
    const digest = createHmac("sha256", secret).update(payload).digest("hex");
    return `sha256=${digest}`;
  }

  it("accepts signature generated with current secret", () => {
    const secret = "top-secret";
    const signature = sign(secret);

    expect(verifyWebhookSignature(payload, signature, secret)).toBe(true);
  });

  it("falls back to previous secret during rotation", () => {
    const currentSecret = "current";
    const previousSecret = "previous";
    const signature = sign(previousSecret);

    expect(
      verifyWebhookSignature(payload, signature, currentSecret, previousSecret),
    ).toBe(true);
  });

  it("rejects malformed signatures", () => {
    const secret = "secret";
    expect(verifyWebhookSignature(payload, "invalid", secret)).toBe(false);
  });

  it("rejects mismatched signatures", () => {
    const secret = "secret";
    const valid = sign(secret);
    const tampered = valid.slice(0, -1) + (valid.endsWith("0") ? "1" : "0");
    expect(verifyWebhookSignature(payload, tampered, secret)).toBe(false);
  });
});
