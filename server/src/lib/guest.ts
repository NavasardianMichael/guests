import type { Request, Response } from 'express'
import { sessionCookieOptions } from './session.js'
import { hashUrlToken, mintUrlToken } from './token.js'

/**
 * A guest's key: what owns the lists kept on the server without an account (`GuestList.guestKeyHash`).
 *
 * A random secret in an httpOnly cookie, stored only hashed, so it lives and dies with this
 * browser's cookies — no other device can reach those lists, and clearing site data loses them.
 * Signing in moves them to the account
 * (`services/guestLists.ts`), after which the cookie is cleared.
 *
 * Twin of `GUEST_COOKIE` in `src/constants/auth.ts`, which the web's proxy reads for presence.
 */
export const GUEST_COOKIE = 'guests-guest'

/** Browsers cap a cookie's lifetime at 400 days; every guest request renews it. */
const GUEST_COOKIE_MAX_AGE_MS = 400 * 24 * 60 * 60 * 1000

/** `mintUrlToken`'s shape. Anything else in the cookie is ignored, not trusted. */
const KEY_PATTERN = /^[0-9a-f]{64}$/

const readGuestKey = (req: Request): string | null => {
  const key: unknown = req.cookies?.[GUEST_COOKIE]
  return typeof key === 'string' && KEY_PATTERN.test(key) ? key : null
}

const setGuestCookie = (res: Response, key: string): void => {
  res.cookie(GUEST_COOKIE, key, { ...sessionCookieOptions(), maxAge: GUEST_COOKIE_MAX_AGE_MS })
}

/** The hash this browser's guest lists are stored under, or null when it has no guest key. */
export const readGuestKeyHash = (req: Request): string | null => {
  const key = readGuestKey(req)
  return key ? hashUrlToken(key) : null
}

/** Renews the cookie's lifetime: a guest who keeps coming back keeps their lists. */
export const renewGuestKey = (req: Request, res: Response): void => {
  const key = readGuestKey(req)
  if (key) setGuestCookie(res, key)
}

/** The browser's guest key hash, minting the key (and setting the cookie) on first use. */
export const ensureGuestKeyHash = (req: Request, res: Response): string => {
  const key = readGuestKey(req) ?? mintUrlToken()
  setGuestCookie(res, key)
  return hashUrlToken(key)
}

export const clearGuestKey = (res: Response): void => {
  res.clearCookie(GUEST_COOKIE, sessionCookieOptions())
}
