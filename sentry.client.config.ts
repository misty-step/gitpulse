import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Performance Monitoring: 10% of transactions sampled
  tracesSampleRate: 0.1,

  // Browser tracing for frontend performance
  integrations: [Sentry.browserTracingIntegration()],

  // Trace requests to Convex backend
  tracePropagationTargets: ["localhost", /^https:\/\/[^/]*\.convex\.cloud/],

  // Session replay: disabled for cost optimization
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,

  // Debug mode: enabled in development
  debug: process.env.NODE_ENV === "development",

  // Environment tracking
  environment: process.env.VERCEL_ENV || process.env.NODE_ENV || "development",
});
