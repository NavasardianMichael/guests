/**
 * Links this server builds into the web app, and the guard on where a redirect may land.
 * Import-free (no config) so `tests/unit/server/` can pin them against the web's
 * `src/constants/routes.ts` and `src/constants/auth.ts`.
 */

/** The query name the web's reset page reads (`RESET_TOKEN_QUERY`). */
export const PASSWORD_RESET_QUERY = 'token'
export const PASSWORD_RESET_PATH = '/auth/reset-password'

/** Linked from the "password changed" notice (`ROUTES.forgotPassword`). */
export const FORGOT_PASSWORD_PATH = '/auth/forgot-password'

/** The query name the web's verification page reads (`VERIFY_TOKEN_QUERY`). */
export const EMAIL_VERIFY_QUERY = 'token'
export const EMAIL_VERIFY_PATH = '/auth/verify-email'

/** Where to land once signed in (`RETURN_TO_QUERY`); carried through the verification link. */
export const RETURN_TO_QUERY = 'returnTo'

/** Where Google sign-in errors land (`ROUTES.signIn`), with `?error=`. */
export const SIGN_IN_PATH = '/auth/sign-in'

/** Where the bank's return trip lands, with `?status=` (`ROUTES.paymentResult`). */
export const PAYMENT_RESULT_PATH = '/payment/result'

/**
 * Its `?status=` (`PAYMENT_RESULT_STATUSES` on the web), with `payment` (the Payment's id) and
 * `list` (where the buyer started, if from a saved list).
 */
export const PAYMENT_RESULT_STATUSES = ['succeeded', 'failed', 'pending'] as const
export type PaymentResultStatus = (typeof PAYMENT_RESULT_STATUSES)[number]

/** Signed-in default destination (`ROUTES.dashboard`). */
export const DASHBOARD_PATH = '/dashboard'

const RETURN_BASE = 'https://return-path.invalid'

/**
 * The post-sign-in destination as a clean same-site path, or `undefined` when it would leave the
 * site (callers then use the dashboard). Without this, `returnTo` is an open redirect. The value
 * is resolved exactly as a browser would resolve it — tabs and line breaks dropped, `\` read as
 * `/` — so `/\t/evil.example` is seen as the `//evil.example` it really is and refused, while a
 * path that merely carries such characters is kept, cleaned. Mirrored by `safeReturnPath` in
 * `src/helpers/url.ts`.
 */
export const safeReturnPath = (value: unknown): string | undefined => {
  if (typeof value !== 'string' || value.length > 512) return undefined
  let url: URL
  try {
    url = new URL(value, RETURN_BASE)
  } catch {
    return undefined
  }
  if (url.origin !== RETURN_BASE) return undefined
  // `/.//evil.example` normalises to the path `//evil.example`, which a redirect would read as a host.
  return `/${url.pathname.replace(/^\/+/, '')}${url.search}${url.hash}`
}

export const buildWebUrl = (origin: string, path: string, query: Record<string, string> = {}): string => {
  const url = new URL(path, origin.endsWith('/') ? origin : `${origin}/`)
  for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value)
  return url.toString()
}
