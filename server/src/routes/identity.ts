import { type Request, type Response, Router } from 'express'
import { googleRouter } from './identity-google.js'
import { fail, ok } from '../lib/api-response.js'
import { sendVerificationLink } from '../lib/email-verification.js'
import { ERROR_CODE } from '../lib/error-codes.js'
import { hashPassword, needsRehash, validatePassword, verifyDummyPassword, verifyPassword } from '../lib/password.js'
import {
  buildPasswordResetUrl,
  issuePasswordResetToken,
  sendPasswordChangedEmail,
  sendPasswordResetEmail,
} from '../lib/password-reset.js'
import { prisma } from '../lib/prisma.js'
import { createRateLimiter } from '../lib/rateLimit.js'
import { asEmail, asFullName } from '../lib/request.js'
import { clearSessionCookie, setSessionCookie } from '../lib/session.js'
import { hashUrlToken } from '../lib/token.js'
import { mapUser } from '../mappers/entities.js'
import { requireAuth, sessionOf } from '../middleware/auth.js'
import { asyncHandler } from '../middleware/error.js'
import { claimGuestLists } from '../services/guestLists.js'

export const identityRouter = Router()

identityRouter.use('/google', googleRouter)

const loginLimiter = createRateLimiter({ limit: 10, windowMs: 15 * 60 * 1000 })
const registerLimiter = createRateLimiter({ limit: 10, windowMs: 60 * 60 * 1000 })
const resetLimiter = createRateLimiter({ limit: 5, windowMs: 60 * 60 * 1000 })
const verifyLimiter = createRateLimiter({ limit: 5, windowMs: 60 * 60 * 1000 })

const limited = (res: Response, retryAfterSeconds: number): void => {
  res.setHeader('Retry-After', String(retryAfterSeconds))
  fail(res, 'Too many attempts', ERROR_CODE.rateLimited, 429)
}

export const issueSession = (res: Response, user: { id: string; tokenVersion: number }): void =>
  setSessionCookie(res, { userId: user.id, tokenVersion: user.tokenVersion })

/**
 * Anonymous is an answer, not an error: `null` with a 200, so no 401 lands in the console.
 * Also where a guest's lists reach an account that was already signed in (in another tab, say).
 */
identityRouter.get(
  '/me',
  asyncHandler(async (req, res) => {
    if (!req.session) return ok(res, null)
    await claimGuestLists(req, res, req.session.userId)
    const user = await prisma.user.findUnique({ where: { id: req.session.userId } })
    ok(res, user ? mapUser(user) : null)
  })
)

/**
 * Creates the account inactive: no session until the emailed link is opened (`/email/verify`).
 * Answers with the address the link went to, for the "check your inbox" screen.
 */
identityRouter.post(
  '/register',
  asyncHandler(async (req, res) => {
    const verdict = registerLimiter(req.ip ?? 'unknown')
    if (!verdict.allowed) return limited(res, verdict.retryAfterSeconds)

    const email = asEmail(req.body?.email)
    const fullName = asFullName(req.body?.fullName)
    if (!email || !fullName) return fail(res, 'Name and a valid email are required', 400, 400)

    const password = validatePassword(req.body?.password, { email })
    if (!password.ok) return fail(res, password.message, ERROR_CODE.weakPassword, 400)

    const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } })
    if (existing) return fail(res, 'An account with this email already exists', ERROR_CODE.emailTaken, 409)

    const user = await prisma.user.create({
      data: { email, fullName, passwordHash: await hashPassword(req.body.password as string) },
    })
    const sent = await sendVerificationLink(user, req.body?.returnTo)
    if (!sent.ok) {
      // Undone, so trying again is a fresh sign-up rather than "email taken" on a dead account.
      await prisma.user.delete({ where: { id: user.id } })
      return fail(res, 'Email could not be sent', 503, 503)
    }
    ok(res, { email: user.email }, 201)
  })
)

identityRouter.post(
  '/login',
  asyncHandler(async (req, res) => {
    const email = asEmail(req.body?.email)
    const password = typeof req.body?.password === 'string' ? (req.body.password as string) : ''

    const verdict = loginLimiter(`${req.ip ?? 'unknown'}:${email ?? ''}`)
    if (!verdict.allowed) return limited(res, verdict.retryAfterSeconds)

    const user = email ? await prisma.user.findUnique({ where: { email } }) : null

    // The same answer, and the same hashing time, for "no such account" and "wrong password".
    if (!user?.passwordHash) {
      await verifyDummyPassword(password)
      if (user && user.googleId) {
        return fail(res, 'This account signs in with Google', ERROR_CODE.googleOnlyAccount, 401)
      }
      return fail(res, 'Invalid email or password', ERROR_CODE.invalidCredentials, 401)
    }
    if (!(await verifyPassword(user.passwordHash, password))) {
      return fail(res, 'Invalid email or password', ERROR_CODE.invalidCredentials, 401)
    }

    if (needsRehash(user.passwordHash)) {
      await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(password) } })
    }
    // Only after the password matched, so this answer reveals nothing a stranger could not already learn.
    if (!user.emailVerifiedAt) {
      return fail(res, 'Email is not verified', ERROR_CODE.emailNotVerified, 403)
    }
    issueSession(res, user)
    await claimGuestLists(req, res, user.id)
    ok(res, mapUser(user))
  })
)

/**
 * A fresh verification link. Always answers ok, so it cannot be used to learn which addresses
 * have accounts; mails only an unverified password account.
 */
identityRouter.post(
  '/email/resend',
  asyncHandler(async (req, res) => {
    const verdict = verifyLimiter(req.ip ?? 'unknown')
    if (!verdict.allowed) return limited(res, verdict.retryAfterSeconds)

    const email = asEmail(req.body?.email)
    const user = email ? await prisma.user.findUnique({ where: { email } }) : null
    if (user?.passwordHash && !user.emailVerifiedAt) {
      const sent = await sendVerificationLink(user, req.body?.returnTo)
      if (!sent.ok) return fail(res, 'Email could not be sent', 503, 503)
    }
    ok(res, null)
  })
)

/**
 * Opening the emailed link activates the account, and only that: no session is issued — the
 * page sends the user to sign in, which also claims the browser's guest lists. Single use: the
 * page asks for a click before calling this, so a mail scanner that prefetches the link
 * cannot spend it.
 */
identityRouter.post(
  '/email/verify',
  asyncHandler(async (req, res) => {
    const token = typeof req.body?.token === 'string' ? (req.body.token as string) : ''
    const user = token
      ? await prisma.user.findUnique({ where: { emailVerifyTokenHash: hashUrlToken(token) } })
      : null
    if (!user || !user.emailVerifyExpiresAt || user.emailVerifyExpiresAt < new Date()) {
      return fail(res, 'Verification link is invalid or expired', ERROR_CODE.verifyTokenInvalid, 400)
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { emailVerifiedAt: user.emailVerifiedAt ?? new Date(), emailVerifyTokenHash: null, emailVerifyExpiresAt: null },
    })
    ok(res, null)
  })
)

identityRouter.post('/logout', (_req: Request, res: Response) => {
  clearSessionCookie(res)
  ok(res, null)
})

identityRouter.patch(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const fullName = asFullName(req.body?.fullName)
    if (!fullName) return fail(res, 'Name is required', 400, 400)
    const user = await prisma.user.update({ where: { id: sessionOf(req).userId }, data: { fullName } })
    ok(res, mapUser(user))
  })
)

/**
 * Sets a password, or changes one, only through the account's mailbox: the same one-hour,
 * single-use link as a forgotten password. A Google-only account sets its first one this way.
 */
identityRouter.post(
  '/password/link',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { userId } = sessionOf(req)
    const verdict = resetLimiter(userId)
    if (!verdict.allowed) return limited(res, verdict.retryAfterSeconds)

    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } })
    const token = await issuePasswordResetToken(user.id)
    const sent = await sendPasswordResetEmail(user.email, buildPasswordResetUrl(token))
    if (!sent.ok) return fail(res, 'Email could not be sent', 503, 503)
    ok(res, null)
  })
)

/** Always answers ok, so the form cannot be used to learn which addresses have accounts. */
identityRouter.post(
  '/password/forgot',
  asyncHandler(async (req, res) => {
    const verdict = resetLimiter(req.ip ?? 'unknown')
    if (!verdict.allowed) return limited(res, verdict.retryAfterSeconds)

    const email = asEmail(req.body?.email)
    const user = email ? await prisma.user.findUnique({ where: { email } }) : null
    if (user) {
      const token = await issuePasswordResetToken(user.id)
      const sent = await sendPasswordResetEmail(user.email, buildPasswordResetUrl(token))
      if (!sent.ok) return fail(res, 'Email could not be sent', 503, 503)
    }
    ok(res, null)
  })
)

identityRouter.post(
  '/password/reset',
  asyncHandler(async (req, res) => {
    const token = typeof req.body?.token === 'string' ? (req.body.token as string) : ''
    const user = token
      ? await prisma.user.findUnique({ where: { passwordResetTokenHash: hashUrlToken(token) } })
      : null
    if (!user || !user.passwordResetExpiresAt || user.passwordResetExpiresAt < new Date()) {
      return fail(res, 'Reset link is invalid or expired', ERROR_CODE.resetTokenInvalid, 400)
    }

    const check = validatePassword(req.body?.password, { email: user.email })
    if (!check.ok) return fail(res, check.message, ERROR_CODE.weakPassword, 400)

    // The link came through the inbox, so it proves the address too: an account that never
    // opened its verification link is activated here.
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await hashPassword(req.body.password as string),
        passwordResetTokenHash: null,
        passwordResetExpiresAt: null,
        emailVerifiedAt: user.emailVerifiedAt ?? new Date(),
        emailVerifyTokenHash: null,
        emailVerifyExpiresAt: null,
        tokenVersion: { increment: 1 },
      },
    })
    issueSession(res, updated)
    // Not awaited: the notice must not hold up, or fail, the reset itself.
    void sendPasswordChangedEmail(updated.email)
    ok(res, mapUser(updated))
  })
)

/** Lists go with the account (cascade). */
identityRouter.delete(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    await prisma.user.delete({ where: { id: sessionOf(req).userId } })
    clearSessionCookie(res)
    ok(res, null)
  })
)
