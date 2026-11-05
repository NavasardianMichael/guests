import * as Sentry from '@sentry/nextjs'
import { ROUTES } from '@constants/routes'
import { sentryOptions } from '@helpers/sentry'

/**
 * Browser error reporting. Off on `/render`, which only the API's headless Chrome opens to
 * print a PDF: its failures surface as the API's failed print, not as a visitor's error.
 */
Sentry.init({
  ...sentryOptions,
  enabled: sentryOptions.enabled && !window.location.pathname.startsWith(ROUTES.render),
})

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
