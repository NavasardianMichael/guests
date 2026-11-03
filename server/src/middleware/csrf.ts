import type { NextFunction, Request, Response } from 'express'
import { config } from '../config.js'
import { fail } from '../lib/api-response.js'

/** GET/HEAD/OPTIONS change nothing, so they need no origin proof. */
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

/**
 * Origin check on every state-changing request.
 *
 * **Why the session cookie's `sameSite: 'lax'` is not enough.** `lax` withholds the cookie
 * on cross-*site* requests except top-level GET navigations, which does cover a plain
 * `<form method="post">` on someone else's page. But "site" is the registrable domain, not
 * the origin, and that leaves two gaps:
 *
 * - In production the web app and this API are different subdomains of one domain, so
 *   *every* sibling subdomain is same-site and unrestricted — including a forgotten
 *   marketing host, a staging box, or one lost to a subdomain takeover. An XSS anywhere on
 *   the domain becomes full CSRF against this API.
 * - In development `:7004` and `:9004` differ only by port, which is not part of the site
 *   either — so `lax` restricts **nothing** locally, and a CSRF regression cannot be
 *   reproduced before it ships. That alone justifies an explicit control.
 *
 * **Why an Origin check rather than a token.** A synchroniser token has nowhere to live:
 * the session is a stateless JWT (`lib/session.ts`) with no server-side record to bank a
 * per-session token in, which is the premise of that design. That leaves double-submit —
 * and double-submit is defeated by exactly the attacker `lax` misses, because a sibling
 * subdomain can set cookies on the parent domain and therefore forge both halves of the
 * pair. `Origin` is set by the browser and cannot be written from script, which is the
 * property actually required here.
 */
export const requireSameOrigin = (req: Request, res: Response, next: NextFunction): void => {
  if (SAFE_METHODS.has(req.method)) return next()

  const blocked = () => fail(res, 'Cross-origin request blocked', 403, 403)

  const origin = req.get('origin')
  if (origin) {
    if (origin !== config.corsOrigin) return blocked()
    return next()
  }

  // Some older browsers omit `Origin` on a same-origin form post. `Referer`'s origin is the
  // same signal, one step weaker, and is still browser-set.
  const referer = req.get('referer')
  if (referer) {
    try {
      if (new URL(referer).origin !== config.corsOrigin) return blocked()
      return next()
    } catch {
      return blocked()
    }
  }

  // Neither header: a non-browser client — curl, Postman, an integration test. Allowed
  // outside production so poking the API locally still works; refused in production, where
  // every legitimate caller is the web app and does send one.
  if (config.nodeEnv === 'production') return blocked()
  return next()
}
