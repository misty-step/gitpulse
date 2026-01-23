import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { verifyWebhookSignature } from "@/lib/github/verifySignature";
import { logger } from "@/lib/logger";

/**
 * GitHub App webhook receiver
 *
 * Handles incoming webhook events from GitHub App installations.
 * Verifies HMAC signature, stores envelope for async processing.
 *
 * Flow:
 * 1. Verify webhook signature (dual-secret for rotation)
 * 2. Store envelope in Convex webhookEvents table
 * 3. Return 200 immediately (<200ms ACK to GitHub)
 *
 * Processing happens asynchronously via Convex actions.
 *
 * @see https://docs.github.com/en/webhooks/using-webhooks/validating-webhook-deliveries
 */
export async function POST(req: NextRequest) {
  const startTime = Date.now();

  try {
    // Extract webhook headers
    const signature = req.headers.get("x-hub-signature-256");
    const deliveryId = req.headers.get("x-github-delivery");
    const event = req.headers.get("x-github-event");

    if (!signature || !deliveryId || !event) {
      return NextResponse.json(
        { error: "Missing required webhook headers" },
        { status: 400 },
      );
    }

    // Read raw body for signature verification
    const rawBody = await req.text();

    // Verify webhook signature with dual-secret support
    const currentSecret = process.env.GITHUB_WEBHOOK_SECRET;
    const previousSecret = process.env.GITHUB_WEBHOOK_SECRET_PREVIOUS;

    if (!currentSecret) {
      logger.error("GITHUB_WEBHOOK_SECRET not configured");
      return NextResponse.json(
        { error: "Webhook secret not configured" },
        { status: 500 },
      );
    }

    const isValid = verifyWebhookSignature(
      rawBody,
      signature,
      currentSecret,
      previousSecret,
    );

    if (!isValid) {
      logger.warn({ deliveryId, event }, "Invalid webhook signature");
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    // Parse payload
    let payload: unknown;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON payload" },
        { status: 400 },
      );
    }

    // Extract installation ID if present
    const installationId = (payload as any)?.installation?.id;

    // Store webhook envelope in Convex
    const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
    if (!convexUrl) {
      logger.error("NEXT_PUBLIC_CONVEX_URL not configured");
      return NextResponse.json(
        { error: "Database not configured" },
        { status: 500 },
      );
    }

    const convex = new ConvexHttpClient(convexUrl);

    await convex.mutation(api.webhookEvents.enqueue, {
      deliveryId,
      event,
      installationId,
      payload,
    });

    const elapsed = Date.now() - startTime;

    // Log successful processing
    logger.info({ deliveryId, event, installationId, elapsedMs: elapsed }, "Webhook enqueued");

    return NextResponse.json({ ok: true, deliveryId }, { status: 200 });
  } catch (error) {
    const elapsed = Date.now() - startTime;

    logger.error(
      { err: error, elapsedMs: elapsed },
      "Webhook processing failed",
    );

    // Return 500 so GitHub retries
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
