import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  // Exclude pino from bundling - it uses worker threads that Turbopack can't handle
  serverExternalPackages: ["pino", "pino-pretty", "thread-stream"],
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: !process.env.CI,
});
