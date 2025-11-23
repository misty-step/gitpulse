import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Performance Monitoring: 10% of transactions sampled
  tracesSampleRate: 0.1,

  // Debug mode: enabled in development
  debug: process.env.NODE_ENV === "development",

  // Environment tracking
  environment: process.env.VERCEL_ENV || process.env.NODE_ENV || "development",
});
