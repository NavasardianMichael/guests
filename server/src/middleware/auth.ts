import type { Request, RequestHandler } from 'express'
import { config } from '../config.js'
import { fail } from '../lib/api-response.js'
import { readGuestKeyHash, renewGuestKey } from '../lib/guest.js'
import { prisma } from '../lib/prisma.js'
import { type SessionPayload, verifySession } from '../lib/session.js'

const readToken = (req: Request): string | undefined => req.cookies?.[config.cookieName] as string | undefined

/**
 * The one place a cookie becomes a trusted identity. The JWT proves we minted it;
 * `User.tokenVersion` is the database's veto (password reset/change, account delete).
 * A request with no cookie never reaches the database.
 */
const authenticate = async (req: Request): Promise<SessionPayload | null> => {
  const token = readToken(req)
  if (!token) return null

  const session = verifySession(token)
  if (!session) return null

  const user = await prisma.user.findUnique({ where: { id: session.userId }, select: { tokenVersion: true } })
  if (!user || user.tokenVersion !== session.tokenVersion) return null

  return session
}

/** Mounted globally. A database blip continues anonymous rather than failing public routes. */
export const optionalAuth: RequestHandler = async (req, _res, next) => {
  try {
    const session = await authenticate(req)
    if (session) req.session = session
  } catch (error) {
    console.error('[auth] optionalAuth session lookup failed', error)
  }
  next()
}

/** One answer for "no cookie", "malformed" and "revoked": all three mean sign in again. */
export const requireAuth: RequestHandler = async (req, res, next) => {
  const session = await authenticate(req)
  if (!session) return fail(res, 'Unauthorized', 401, 401)
  req.session = session
  next()
}

/**
 * Who a list route acts for: the signed-in account, else this browser's guest key (a list kept
 * without an account, `lib/guest.ts`). Either shape is also the Prisma `where` fragment that
 * scopes every query to that owner.
 */
export type ListOwner = { userId: string } | { guestKeyHash: string }

/**
 * The list routes' gate: a session, or a guest key. A signed-in user is always the account —
 * their guest lists were moved to it on sign-in. `optionalAuth`, mounted globally, has already
 * verified the session cookie.
 */
export const requireListOwner: RequestHandler = (req, res, next) => {
  if (req.session) {
    req.listOwner = { userId: req.session.userId }
    return next()
  }
  const guestKeyHash = readGuestKeyHash(req)
  if (!guestKeyHash) return fail(res, 'Unauthorized', 401, 401)
  renewGuestKey(req, res)
  req.listOwner = { guestKeyHash }
  next()
}

/** For a handler behind `requireListOwner`. */
export const listOwnerOf = (req: Request): ListOwner => {
  if (!req.listOwner) throw new Error('listOwnerOf called outside requireListOwner')
  return req.listOwner
}

/** A rate-limit key per owner. */
export const ownerKey = (owner: ListOwner): string => ('userId' in owner ? owner.userId : `guest:${owner.guestKeyHash}`)

/** For a handler behind `requireAuth`, where the session is guaranteed. */
export const sessionOf = (req: Request): SessionPayload => {
  if (!req.session) throw new Error('sessionOf called outside requireAuth')
  return req.session
}
