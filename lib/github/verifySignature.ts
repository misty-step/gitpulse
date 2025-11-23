import { createHmac, timingSafeEqual } from "crypto";

/**
 * Verify GitHub webhook signature with dual-secret support for rotation
 *
 * GitHub signs webhook payloads with HMAC-SHA256 using the webhook secret.
 * During secret rotation, we verify against both current and previous secrets
 * to allow zero-downtime transitions.
 *
 * @param payload - Raw webhook payload (JSON string)
 * @param signature - X-Hub-Signature-256 header value (e.g., "sha256=...")
 * @param currentSecret - Current webhook secret
 * @param previousSecret - Optional previous secret for rotation window
 * @returns true if signature matches either secret, false otherwise
 *
 * @see https://docs.github.com/en/webhooks/using-webhooks/validating-webhook-deliveries
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string,
  currentSecret: string,
  previousSecret?: string,
): boolean {
  // Signature format: "sha256=<hex-digest>"
  if (!signature || !signature.startsWith("sha256=")) {
    return false;
  }

  const providedSignature = signature.slice(7); // Remove "sha256=" prefix

  // Verify against current secret
  if (verifyAgainstSecret(payload, providedSignature, currentSecret)) {
    return true;
  }

  // If provided, verify against previous secret (rotation window)
  if (previousSecret) {
    return verifyAgainstSecret(payload, providedSignature, previousSecret);
  }

  return false;
}

/**
 * Verify signature against a single secret using timing-safe comparison
 */
function verifyAgainstSecret(
  payload: string,
  providedSignature: string,
  secret: string,
): boolean {
  const expectedSignature = createHmac("sha256", secret)
    .update(payload)
    .digest("hex");

  // Use timing-safe comparison to prevent timing attacks
  try {
    return timingSafeEqual(
      Buffer.from(providedSignature, "hex"),
      Buffer.from(expectedSignature, "hex"),
    );
  } catch {
    // timingSafeEqual throws if buffers have different lengths
    return false;
  }
}
