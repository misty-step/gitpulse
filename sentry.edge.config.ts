import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Performance Monitoring: 10% of transactions sampled
  tracesSampleRate: 0.1,

  // Debug mode: disabled (too noisy in dev)
  debug: false,

  // Environment tracking
  environment: process.env.VERCEL_ENV || process.env.NODE_ENV || "development",

  beforeSend(event) {
    // Scrub PII to comply with privacy requirements
    if (event.user) {
      delete event.user.email;
      delete event.user.ip_address;
    }
    if (event.extra) {
      delete event.extra.password;
      delete event.extra.accessToken;
      delete event.extra.refreshToken;
      delete event.extra.token;
    }
    return event;
  },
});
