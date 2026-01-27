import * as Sentry from "@sentry/nextjs";
import { scrubPii, getSentryEnvironment } from "@/lib/sentry";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  debug: false,
  environment: getSentryEnvironment(),
  beforeSend: scrubPii,
});
