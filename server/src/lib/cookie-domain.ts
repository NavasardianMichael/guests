/**
 * The session cookie's `Domain`, derived from the web origin.
 *
 * Its own module, importing nothing, for the same reason `lib/return-path.ts` is: `config.ts`
 * pulls in `load-env.js`, which puts anything living there out of reach of
 * `tests/unit/server/` (see `tests/CLAUDE.md`). This particular rule earned a test — it was
 * wrong in production and the symptom pointed nowhere near it.
 *
 * Read `config.cookieDomain` for what the value is *for*; this file is only how it is chosen.
 */

/**
 * Empty means host-only, which is the browser's own default.
 *
 * - **Not production** → empty. Dev serves web and API from `localhost:7004` and
 *   `localhost:9004`; cookies ignore ports, so one host-only cookie already covers both.
 * - **No dot in the hostname** → empty. A `Domain` of `localhost` is rejected outright by
 *   browsers, and emitting one would be strictly worse than omitting the attribute.
 * - **Otherwise** → the web origin's hostname. It covers itself and its subdomains, which in
 *   the documented topology is exactly the `api.` host. Deliberately *not* the registrable
 *   domain: that would put the session JWT on every sibling subdomain's requests.
 *
 * An unparseable origin yields empty rather than throwing — a bad `CORS_ORIGIN` should fail
 * at `requireSameOrigin`, where the error names the real problem, not at process boot with a
 * `URL` stack trace.
 */
export const deriveCookieDomain = (nodeEnv: string, corsOrigin: string): string => {
  if (nodeEnv !== 'production') return ''

  try {
    const { hostname } = new URL(corsOrigin)
    return hostname.includes('.') ? hostname : ''
  } catch {
    return ''
  }
}
