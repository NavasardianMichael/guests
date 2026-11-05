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

/** Signed-in default destination (`ROUTES.dashboard`). */
export const DASHBOARD_PATH = '/dashboard'

/**
 * A post-sign-in destination is accepted only as a same-site path: it must start with a single
 * `/`, so `//evil.example` and `/\evil.example` (both protocol-relative to a browser) and any
 * absolute URL are refused. Without this, `returnTo` is an open redirect.
 */
export const isSafeReturnPath = (value: unknown): value is string =>
  typeof value === 'string' &&
  value.length <= 512 &&
  value.startsWith('/') &&
  !value.startsWith('//') &&
  !value.startsWith('/\\') &&
  !/[\r\n]/.test(value)

export const buildWebUrl = (origin: string, path: string, query: Record<string, string> = {}): string => {
  const url = new URL(path, origin.endsWith('/') ? origin : `${origin}/`)
  for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value)
  return url.toString()
}
