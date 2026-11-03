/**
 * A fixed-window, per-key request counter.
 *
 * This exists because of a detail that is easy to miss: the mail engine rate-limits at
 * 10 requests per minute **per IP as it sees them**, and it only ever sees this server.
 * So every visitor shares one bucket, and one script hammering the contact form would
 * exhaust the budget for real transactional mail — verification links included. Limiting
 * at our own edge keeps that from being reachable.
 *
 * **In-memory and per-process.** Counters reset on restart and are not shared across
 * instances, so this is a cheap abuse brake, not an accounting boundary. Behind more than
 * one API process it must move to Redis or the proxy; until then a single `tsx`/`node`
 * process holds all traffic and this is accurate.
 */

type Window = {
  count: number
  /** Epoch ms at which `count` resets. */
  resetAt: number
}

export type RateLimitVerdict =
  | { allowed: true }
  /** Whole seconds until the window rolls over — the value for `Retry-After`. */
  | { allowed: false; retryAfterSeconds: number }

export type RateLimiter = (key: string) => RateLimitVerdict

/**
 * Entries are swept lazily on write rather than on a timer, so an idle process holds no
 * interval and cannot keep the event loop alive. The sweep is bounded by how many keys
 * arrived in one window, which the limit itself caps.
 */
export const createRateLimiter = ({ limit, windowMs }: { limit: number; windowMs: number }): RateLimiter => {
  const windows = new Map<string, Window>()

  return (key) => {
    const now = Date.now()

    for (const [existing, window] of windows) {
      if (window.resetAt <= now) windows.delete(existing)
    }

    const window = windows.get(key)
    if (!window || window.resetAt <= now) {
      windows.set(key, { count: 1, resetAt: now + windowMs })
      return { allowed: true }
    }

    if (window.count >= limit) {
      return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((window.resetAt - now) / 1000)) }
    }

    window.count += 1
    return { allowed: true }
  }
}
