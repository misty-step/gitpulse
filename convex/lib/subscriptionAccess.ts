export function hasActiveSubscription(status: string): boolean {
  return status === "trialing" || status === "active";
}
