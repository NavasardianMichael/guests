/**
 * Error reporting for the web app, shared by the browser (`instrumentation-client.ts`) and
 * Next's own server (`instrumentation.ts`). `NEXT_PUBLIC_SENTRY_DSN` is inlined at build time,
 * so an empty one — local dev, CI — leaves Sentry off everywhere.
 *
 * Errors only: no tracing and no session replay, and no default PII. A CV is personal data,
 * and none of it belongs in an error report.
 */
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN ?? ''

export const sentryOptions = {
  dsn,
  enabled: Boolean(dsn),
  environment: process.env.NODE_ENV,
  sendDefaultPii: false,
} as const
