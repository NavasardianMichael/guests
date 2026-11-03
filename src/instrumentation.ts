import * as Sentry from '@sentry/nextjs'
import { sentryOptions } from '@helpers/sentry'

/** Next's own server and the proxy: errors while rendering, in route handlers and in `proxy.ts`. */
export function register(): void {
  Sentry.init(sentryOptions)
}

export const onRequestError = Sentry.captureRequestError
