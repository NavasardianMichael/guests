import { accessWindow } from './entitlement.js'
import { coerceContent } from './listDocument.js'
import { buildPaymentMail, type PaymentFacts, type PaymentMailEvent, type SettleSource } from './paymentMail.js'
import { PASS_DAYS } from './pricing.js'
import { config } from '../config.js'
import { type InternalMailPayload, isMailConfigured, sendInternalMail } from '../lib/mail.js'
import { prisma } from '../lib/prisma.js'
import { createRateLimiter } from '../lib/rateLimit.js'
import type { RequestInfo } from '../lib/request-info.js'

/**
 * Tells the admin inbox (the mail engine's internal endpoint) when a buyer clicks "pay" and
 * when a payment settles. Best effort: callers fire and forget, every failure is logged here
 * and nothing is thrown — a notification must never stand between a buyer and the bank.
 *
 * - `started` is sent from `startCheckout`, once the gateway answered (or refused).
 * - `succeeded` is sent from `settlePayment` by the caller that won the `pending → succeeded`
 *   claim, so exactly once per payment whichever path settled it.
 */

/**
 * The engine allows 10 sends a minute for this whole server, shared with verification and
 * password mail (`lib/rateLimit.ts`). Real buyers come nowhere near this; a script clicking
 * "pay" from many guest keys would, so past it a click is only logged. Paid mails are never
 * capped: each one is real money.
 */
const startedLimiter = createRateLimiter({ limit: 30, windowMs: 60 * 60 * 1000 })

const loadFacts = async (paymentId: string): Promise<PaymentFacts | null> => {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { user: { include: { _count: { select: { lists: true } } } }, list: true },
  })
  if (!payment) return null

  // The pass is the buyer's: an account, or a guest browser's key.
  const owner = payment.userId ? { userId: payment.userId } : payment.guestKeyHash ? { guestKeyHash: payment.guestKeyHash } : null
  const [attempt, paidBefore, guestListCount, passes] = await Promise.all([
    owner ? prisma.payment.count({ where: { ...owner, createdAt: { lte: payment.createdAt } } }) : Promise.resolve(1),
    owner ? prisma.payment.count({ where: { ...owner, status: 'succeeded', id: { not: payment.id } } }) : Promise.resolve(0),
    payment.guestKeyHash ? prisma.guestList.count({ where: { guestKeyHash: payment.guestKeyHash } }) : Promise.resolve(0),
    owner && payment.status === 'succeeded'
      ? prisma.payment.findMany({ where: { ...owner, status: 'succeeded' }, select: { id: true, paidAt: true, createdAt: true } })
      : Promise.resolve([]),
  ])
  const accessUntil = passes.length
    ? accessWindow(passes.map((row) => ({ id: row.id, paidAt: row.paidAt ?? row.createdAt })), PASS_DAYS).until
    : null

  const { user, list } = payment
  const content = list ? coerceContent(list.content) : null

  return {
    payment: {
      id: payment.id,
      orderNumber: payment.orderNumber,
      amount: payment.amount,
      currency: payment.currency,
      gateway: payment.gateway,
      gatewayTestMode: payment.gateway === 'mock' || (payment.gateway === 'ameria' && config.payments.ameria.testMode),
      gatewayPaymentId: payment.gatewayPaymentId,
      status: payment.status,
      failureReason: payment.failureReason,
      createdAt: payment.createdAt,
      paidAt: payment.paidAt,
      attempt,
      accessUntil,
    },
    buyer: user
      ? {
          kind: 'account',
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          emailVerified: Boolean(user.emailVerifiedAt),
          signIn: [user.passwordHash && 'password', user.googleId && 'Google'].filter(Boolean).join(' + ') || 'nothing',
          createdAt: user.createdAt,
          listCount: user._count.lists,
          paidBefore,
        }
      : { kind: 'guest', guestListCount, paidBefore },
    list:
      list && content
        ? {
            id: list.id,
            title: list.title,
            templateId: list.templateId,
            kind: list.kind,
            guestCount: list.guestCount,
            tableCount: content.tables.length,
            heading: content.heading,
            subheading: content.subheading,
            createdAt: list.createdAt,
            updatedAt: list.updatedAt,
          }
        : null,
  }
}

/**
 * Sent only in production: a dev machine with the mail engine configured (for verification
 * and reset mail) would otherwise fill the admin inbox with test purchases. Elsewhere the
 * mail prints here instead.
 */
const deliver = async (payload: InternalMailPayload): Promise<void> => {
  if (config.nodeEnv !== 'production') {
    const lines = Object.entries(payload.details ?? {}).map(([key, value]) => (value === '' ? key : `  ${key}: ${String(value)}`))
    console.log(`[notify] ${payload.subject} (not sent outside production)\n${payload.body}\n${lines.join('\n')}`)
    return
  }
  if (!isMailConfigured()) {
    console.error(`[notify] "${payload.subject}" not sent: MAIL_API_URL or MAIL_API_KEY is empty`)
    return
  }
  const result = await sendInternalMail(payload)
  if (!result.ok) console.error(`[notify] "${payload.subject}" not sent: ${result.status} ${result.message}`)
}

const notify = async (
  event: PaymentMailEvent,
  paymentId: string,
  request: RequestInfo | null,
  source?: SettleSource
): Promise<void> => {
  try {
    if (event === 'started' && !startedLimiter('all').allowed) {
      console.warn(`[notify] checkout mail for payment ${paymentId} skipped: over the hourly cap`)
      return
    }
    const facts = await loadFacts(paymentId)
    if (!facts) return
    await deliver(buildPaymentMail(event, facts, request, source))
  } catch (error) {
    console.error(`[notify] ${event} mail for payment ${paymentId} failed`, error instanceof Error ? error.message : error)
  }
}

/** Never rejects. */
export const notifyCheckoutStarted = (paymentId: string, request: RequestInfo | null): Promise<void> =>
  notify('started', paymentId, request)

/** Never rejects. */
export const notifyPaymentSucceeded = (
  paymentId: string,
  request: RequestInfo | null,
  source: SettleSource
): Promise<void> => notify('succeeded', paymentId, request, source)
