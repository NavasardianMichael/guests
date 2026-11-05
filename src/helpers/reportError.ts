import * as Sentry from '@sentry/nextjs'

/**
 * The one place an error goes when it is recorded rather than (or as well as) shown.
 *
 * Every failure the UI deliberately keeps quiet about — a decorative badge, a prefill,
 * service-worker registration — still comes through here, so "silent" never means
 * "invisible to whoever is debugging it": the console, and Sentry tagged with `context`
 * (a no-op while Sentry is off, `helpers/sentry.ts`).
 */
export const reportError = (error: unknown, context: string): void => {
  console.error(`[${context}]`, error)
  Sentry.captureException(error, { tags: { context } })
}
