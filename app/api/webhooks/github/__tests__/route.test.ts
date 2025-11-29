import { createHmac } from "crypto";
import type { NextRequest } from "next/server";

jest.mock("@/convex/_generated/api", () => ({
  api: {
    webhookEvents: { enqueue: "webhookEvents.enqueue" },
  },
}));

import { api } from "@/convex/_generated/api";
import { POST } from "../route";

const mutationMock = jest.fn();

jest.mock("convex/browser", () => ({
  ConvexHttpClient: jest.fn().mockImplementation(() => ({
    mutation: mutationMock,
  })),
}));

 
import { ConvexHttpClient } from "convex/browser";

const originalEnv = { ...process.env };

function sign(body: string, secret: string) {
  return `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
}

function buildRequest(body: string, headers: Record<string, string>): NextRequest {
  const nextHeaders = new Headers(headers);

  return {
    headers: nextHeaders,
    text: () => Promise.resolve(body),
  } as unknown as NextRequest;
}

describe("POST /api/webhooks/github", () => {
  const convexUrl = "https://convex.example";
  const currentSecret = "current-secret";
  const previousSecret = "previous-secret";
  const basePayload = JSON.stringify({
    action: "opened",
    installation: { id: 42 },
  });

  beforeEach(() => {
    jest.spyOn(console, "log").mockImplementation(() => {});
    mutationMock.mockReset();
    (ConvexHttpClient as jest.Mock).mockClear();
    process.env = {
      ...originalEnv,
      NEXT_PUBLIC_CONVEX_URL: convexUrl,
      GITHUB_WEBHOOK_SECRET: currentSecret,
    };
    delete process.env.GITHUB_WEBHOOK_SECRET_PREVIOUS;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("accepts a valid signature and enqueues the webhook", async () => {
    mutationMock.mockResolvedValue("webhook-1");

    const response = await POST(
      buildRequest(basePayload, {
        "x-hub-signature-256": sign(basePayload, currentSecret),
        "x-github-delivery": "delivery-1",
        "x-github-event": "pull_request",
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      deliveryId: "delivery-1",
    });

    expect(ConvexHttpClient).toHaveBeenCalledWith(convexUrl);
    expect(mutationMock).toHaveBeenCalledWith(
      api.webhookEvents.enqueue,
      expect.objectContaining({
        deliveryId: "delivery-1",
        event: "pull_request",
        installationId: 42,
      }),
    );
  });

  it("rejects an invalid signature", async () => {
    const response = await POST(
      buildRequest(basePayload, {
        "x-hub-signature-256": sign(basePayload, "wrong-secret"),
        "x-github-delivery": "delivery-2",
        "x-github-event": "pull_request",
      }),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Invalid signature" });
    expect(mutationMock).not.toHaveBeenCalled();
  });

  it("rejects when required headers are missing", async () => {
    const response = await POST(
      buildRequest(basePayload, {
        "x-github-delivery": "delivery-3",
        "x-github-event": "pull_request",
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Missing required webhook headers",
    });
    expect(mutationMock).not.toHaveBeenCalled();
  });

  it("accepts signatures generated with the previous secret during rotation", async () => {
    process.env.GITHUB_WEBHOOK_SECRET_PREVIOUS = previousSecret;
    mutationMock.mockResolvedValue("webhook-rotation");

    const response = await POST(
      buildRequest(basePayload, {
        "x-hub-signature-256": sign(basePayload, previousSecret),
        "x-github-delivery": "delivery-rotation",
        "x-github-event": "pull_request",
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      deliveryId: "delivery-rotation",
    });
  });

  it("returns 400 for malformed JSON payloads", async () => {
    const invalidPayload = "{not-json";

    const response = await POST(
      buildRequest(invalidPayload, {
        "x-hub-signature-256": sign(invalidPayload, currentSecret),
        "x-github-delivery": "delivery-4",
        "x-github-event": "push",
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Invalid JSON payload",
    });
    expect(mutationMock).not.toHaveBeenCalled();
  });

  it("rejects requests missing the GitHub event header", async () => {
    const response = await POST(
      buildRequest(basePayload, {
        "x-hub-signature-256": sign(basePayload, currentSecret),
        "x-github-delivery": "delivery-5",
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Missing required webhook headers",
    });
    expect(mutationMock).not.toHaveBeenCalled();
  });

  it("fails closed-channel signatures without leaking timing information", async () => {
    const shortSignature = "sha256=1234"; // length mismatch triggers timingSafeEqual catch

    const response = await POST(
      buildRequest(basePayload, {
        "x-hub-signature-256": shortSignature,
        "x-github-delivery": "delivery-6",
        "x-github-event": "pull_request",
      }),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Invalid signature" });
    expect(mutationMock).not.toHaveBeenCalled();
  });

  it("handles replayed delivery IDs idempotently", async () => {
    mutationMock.mockResolvedValueOnce("webhook-7").mockResolvedValueOnce("webhook-7");

    const headers = {
      "x-hub-signature-256": sign(basePayload, currentSecret),
      "x-github-delivery": "delivery-7",
      "x-github-event": "pull_request",
    };

    const first = await POST(buildRequest(basePayload, headers));
    const second = await POST(buildRequest(basePayload, headers));

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(mutationMock).toHaveBeenCalledTimes(2);
  });
});
