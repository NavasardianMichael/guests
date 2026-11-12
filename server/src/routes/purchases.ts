import { type Request, Router } from 'express'
import { isPaymentConfigured } from '../config.js'
import { fail, ok } from '../lib/api-response.js'
import { ERROR_CODE } from '../lib/error-codes.js'
import { ensureGuestKeyHash, readGuestKeyHash, renewGuestKey } from '../lib/guest.js'
import { prisma } from '../lib/prisma.js'
import { createRateLimiter } from '../lib/rateLimit.js'
import { readRequestInfo } from '../lib/request-info.js'
import type { ListOwner } from '../middleware/auth.js'
import { asyncHandler } from '../middleware/error.js'
import { accessUntil, findOpenPayment, reconcileOwnerPayments, resumeOpenPayment, startCheckout } from '../services/payments.js'

/**
 * Access passes (docs/PAYMENTS.md). A pass belongs to an account, or — bought without one — to
 * this browser's guest key until its owner signs in (`services/guestLists.ts`).
 */
export const purchasesRouter = Router()

const checkoutLimiter = createRateLimiter({ limit: 10, windowMs: 10 * 60 * 1000 })

const ownerOf = (req: Request): ListOwner | null => {
  if (req.session) return { userId: req.session.userId }
  const guestKeyHash = readGuestKeyHash(req)
  return guestKeyHash ? { guestKeyHash } : null
}

/**
 * When this visitor's access ends (`accessUntil`: ISO, in the past once it has run out, null if
 * they never bought). Anyone may ask: a visitor with neither session nor guest key has none.
 * Reading re-checks their recent pending payments (a tab closed before the bank's redirect),
 * so the payment result page polls this — with `?payment=<id>`, which also answers that
 * payment's status (`payment`, null unless it is this visitor's).
 */
purchasesRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const owner = ownerOf(req)
    if (!owner) return ok(res, { accessUntil: null, payment: null })
    if (!req.session) renewGuestKey(req, res)
    const until = await accessUntil(owner, { source: 'access', request: readRequestInfo(req) })
    const paymentId = typeof req.query.payment === 'string' && req.query.payment.length <= 64 ? req.query.payment : null
    const payment = paymentId ? await prisma.payment.findFirst({ where: { id: paymentId, ...owner }, select: { status: true } }) : null
    ok(res, { accessUntil: until?.toISOString() ?? null, payment: payment?.status ?? null })
  })
)

/**
 * Starts buying a pass: answers the bank page's URL (`redirectUrl`). Without a session the
 * browser's guest key is minted and owns the purchase — the web warns about that first.
 * `listId`, when it is the buyer's own list, is where the result page leads back to. Buying
 * while a pass runs is allowed: the days go on top. `client` is the browser's device facts,
 * for the admin's "checkout started" mail only (`lib/request-info.ts`).
 *
 * Two answers that are not a payment page:
 * - `earlierPaymentSucceeded` (409): a payment whose redirect never arrived turns out to have
 *   gone through — access is running, and the buyer is told before they pay again;
 * - `{ openPayment: { minutesAgo } }`: an earlier bank page may still be open in another tab;
 *   the page asks, and resends with `resume: true` to be sent to that same order.
 */
purchasesRouter.post(
  '/checkout',
  asyncHandler(async (req, res) => {
    if (!isPaymentConfigured()) return fail(res, 'Payments are unavailable', ERROR_CODE.paymentsUnavailable, 503)

    const limitKey = req.session ? req.session.userId : `ip:${req.ip ?? 'unknown'}`
    const verdict = checkoutLimiter(limitKey)
    if (!verdict.allowed) {
      res.setHeader('Retry-After', String(verdict.retryAfterSeconds))
      return fail(res, 'Too many attempts', ERROR_CODE.rateLimited, 429)
    }

    const owner: ListOwner = req.session ? { userId: req.session.userId } : { guestKeyHash: ensureGuestKeyHash(req, res) }
    const request = readRequestInfo(req)
    const body = (req.body ?? {}) as { listId?: unknown; resume?: unknown }

    if (await reconcileOwnerPayments(owner, { source: 'checkout', request })) {
      return fail(res, 'An earlier payment went through', ERROR_CODE.earlierPaymentSucceeded, 409)
    }

    const openPayment = await findOpenPayment(owner)
    if (openPayment) {
      if (body.resume !== true) return ok(res, { openPayment: { minutesAgo: openPayment.minutesAgo } })
      const resumeUrl = await resumeOpenPayment(openPayment.id)
      if (resumeUrl) return ok(res, { redirectUrl: resumeUrl })
    }

    const list =
      typeof body.listId === 'string' && body.listId.length <= 64
        ? await prisma.guestList.findFirst({ where: { id: body.listId, ...owner }, select: { id: true } })
        : null
    const redirectUrl = await startCheckout(owner, { listId: list?.id ?? null }, request)
    ok(res, { redirectUrl })
  })
)
