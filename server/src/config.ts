import { deriveCookieDomain } from './lib/cookie-domain.js'

import './load-env.js'

const nodeEnv = process.env.NODE_ENV ?? 'development'
const corsOrigin = (process.env.CORS_ORIGIN ?? 'http://localhost:7010').replace(/\/+$/, '')
const port = Number(process.env.PORT ?? 9010)

/** The only reader of `process.env` (with `load-env.ts`). */
export const config = {
  port,
  /** Every interface in dev; production sets `HOST=127.0.0.1` so only nginx reaches it. */
  host: process.env.HOST ?? '0.0.0.0',
  nodeEnv,
  jwtSecret: process.env.JWT_SECRET ?? 'dev-secret-change-me',
  corsOrigin,
  /** This API's public origin: links back to it (Google's redirect) are built on it. */
  apiPublicUrl: (process.env.API_PUBLIC_URL ?? `http://localhost:${port}`).replace(/\/+$/, ''),
  /** Where headless Chrome opens the web app's `/render` page. */
  renderOrigin: (process.env.RENDER_ORIGIN ?? corsOrigin).replace(/\/+$/, ''),
  puppeteerNoSandbox: process.env.PUPPETEER_NO_SANDBOX === 'true',
  cookieName: 'guests-session',
  /**
   * `Domain` on the session cookie. Empty (host-only) in dev; in production the web host's
   * name, so a cookie minted by `api.<web host>` is also visible to the web app's proxy guard.
   * See `lib/cookie-domain.ts`.
   */
  cookieDomain: process.env.COOKIE_DOMAIN ?? deriveCookieDomain(nodeEnv, corsOrigin),
  oauthCookieName: 'guests-oauth',
  oauthFlowTtlMs: 10 * 60 * 1000,
  /** A reset link is a full credential, so it lives an hour. */
  passwordResetTtlMs: 60 * 60 * 1000,
  /** A verification link only activates an account the owner just made, so it may wait in the inbox. */
  emailVerifyTtlMs: 48 * 60 * 60 * 1000,
  /** External mail engine. `apiKey` is read only by `lib/mail.ts`. Empty disables sending. */
  mail: {
    apiUrl: (process.env.MAIL_API_URL ?? '').replace(/\/+$/, ''),
    apiKey: process.env.MAIL_API_KEY ?? '',
  },
  /** Google OAuth. `clientSecret` is read only by `lib/google-oauth.ts`. Empty disables it. */
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID ?? '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
    redirectUri: process.env.GOOGLE_REDIRECT_URI ?? `http://localhost:${port}/identity/google/callback`,
  },
  /** Photo import (`services/guestReader.ts`). `apiKey` is read only there. Empty disables it. */
  gemini: {
    apiKey: process.env.GEMINI_API_KEY ?? '',
  },
}

export const isGoogleOAuthConfigured = (): boolean =>
  Boolean(config.google.clientId && config.google.clientSecret && config.google.redirectUri)

/** Whether photos can be read into guests (the web hides the option when not). */
export const isAiConfigured = (): boolean => Boolean(config.gemini.apiKey)
