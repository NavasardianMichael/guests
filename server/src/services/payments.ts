import type { Payment, PaymentStatus, Prisma } from '@prisma/client'
import { accessWindow, type PaidPass, type PrintTerms, printTerms } from './entitlement.js'
import { GATEWAYS } from './gateways/index.js'
import { PASS_DAYS, PASS_PRICE_AMD } from './pricing.js'
import { config } from '../config.js'
import type { TemplateId } from '../lib/catalogue.js'
import { ERROR_CODE } from '../lib/error-codes.js'
import { prisma } from '../lib/prisma.js'
import type { ListOwner } from '../middleware/auth.js'
import { HttpError } from '../middleware/error.js'

/**
 * Access passes (docs/PAYMENTS.md). cv-builder's flow, with one difference: what is bought is
 * **time** — `PASS_DAYS` of everything for the buyer — not a document or a template. Succeeded
 * payments are the passes; nothing else records them.
 *
 * - `startCheckout` writes a `pending` Payment, asks the gateway for a payment page, and
 *   returns its URL. Nothing is unlocked here. Buying while a pass runs is allowed: the new
 *   days go on top (`accessWindow`).
 * - `settlePayment` is the **only** writer of `succeeded`. It asks the gateway, server to
 *   server, and moves the row out of `pending` by compare-and-set, so the return redirect, a
 *   page reload and a reconcile racing each other settle it once.
 * - `reconcileOwnerPayments` covers the buyer who paid and closed the tab before the redirect:
 *   reading the owner's access, or printing, re-checks their recent pending payments.
 *   Computed on read, no background job.
 * - `revalidatePass` drops a refunded payment's days before the next clean print.
 */

const RECONCILE_WINDOW_MS = 3 * 24 * 60 * 60 * 1000

/** A payment owned by this account or guest key: `ListOwner` is that `where` fragment as it is. */
const ownedBy = (owner: ListOwner): Prisma.PaymentWhereInput => owner

const paidPasses = async (owner: ListOwner): Promise<PaidPass[]> => {
  const rows = await prisma.payment.findMany({
    where: { ...ownedBy(owner), status: 'succeeded' },
    select: { id: true, paidAt: true, createdAt: true },
  })
  // `paidAt` is set by `settlePayment`; a row without it (written by hand) counts from creation.
  return rows.map((row) => ({ id: row.id, paidAt: row.paidAt ?? row.createdAt }))
}

const windowOf = async (owner: ListOwner): Promise<ReturnType<typeof accessWindow>> => accessWindow(await paidPasses(owner), PASS_DAYS)

/**
 * When this owner's access ends — in the past once it has run out, null if they never bought.
 * Pending payments from the last days are settled first.
 */
export const accessUntil = async (owner: ListOwner): Promise<Date | null> => {
  await reconcileOwnerPayments(owner)
  return (await windowOf(owner)).until
}

/**
 * Starts buying a pass for this owner and returns the bank page's URL. `listId` is only where
 * the buyer started (the result page links back to it) and must already be the owner's.
 */
export const startCheckout = async (owner: ListOwner, input: { listId: string | null }): Promise<string> => {
  const gatewayId = config.payments.gateway
  const gateway = GATEWAYS[gatewayId]

  const payment = await prisma.payment.create({
    data: { ...owner, listId: input.listId, amount: PASS_PRICE_AMD, gateway: gatewayId },
  })

  try {
    const { gatewayPaymentId, redirectUrl } = await gateway.init({
      orderNumber: payment.orderNumber,
      amount: payment.amount,
      description: `Իմ հյուրերը — լիարժեք հասանելիություն ${PASS_DAYS} օրով`,
      backUrl: `${config.apiPublicUrl}/payments/return/${gatewayId}`,
      opaque: payment.id,
    })
    await prisma.payment.update({ where: { id: payment.id }, data: { gatewayPaymentId } })
    return redirectUrl
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'init failed'
    console.error(`[payments] init failed for payment ${payment.id}: ${reason}`)
    await prisma.payment.update({ where: { id: payment.id }, data: { status: 'failed', failureReason: reason.slice(0, 500) } })
    throw new HttpError(502, 'Payment could not be started', ERROR_CODE.paymentInitFailed)
  }
}

export const settlePayment = async (payment: Payment): Promise<PaymentStatus> => {
  if (payment.status !== 'pending' || !payment.gatewayPaymentId) return payment.status

  const verdict = await GATEWAYS[payment.gateway].check(payment.gatewayPaymentId, {
    orderNumber: payment.orderNumber,
    amount: payment.amount,
  })
  if (verdict.status === 'pending') return 'pending'

  if (verdict.status === 'failed') {
    await prisma.payment.updateMany({
      where: { id: payment.id, status: 'pending' },
      data: { status: 'failed', failureReason: verdict.reason },
    })
    return 'failed'
  }

  await prisma.payment.updateMany({
    where: { id: payment.id, status: 'pending' },
    data: { status: 'succeeded', paidAt: new Date() },
  })
  return 'succeeded'
}

/** Re-checks this owner's recent pending payments. Gateway failures are logged, never thrown at a reader. */
export const reconcileOwnerPayments = async (owner: ListOwner): Promise<void> => {
  const pending = await prisma.payment.findMany({
    where: {
      ...ownedBy(owner),
      status: 'pending',
      gatewayPaymentId: { not: null },
      createdAt: { gte: new Date(Date.now() - RECONCILE_WINDOW_MS) },
    },
    orderBy: { createdAt: 'desc' },
    take: 5,
  })

  for (const payment of pending) {
    try {
      await settlePayment(payment)
    } catch (error) {
      console.error(`[payments] reconcile of ${payment.id} failed`, error instanceof Error ? error.message : error)
    }
  }
}

/**
 * The running pass, re-checked before it prints: a refund or void made later in the bank's
 * panel takes its days back. Each payment of the running window is re-read from its gateway,
 * and a reversed one becomes `refunded`; the caller then computes the window again. A gateway
 * that cannot answer counts as still paid — an outage must not lock a buyer out.
 */
const revalidatePass = async (chain: readonly PaidPass[]): Promise<void> => {
  const payments = await prisma.payment.findMany({
    where: { id: { in: chain.map((payment) => payment.id) }, status: 'succeeded', gatewayPaymentId: { not: null } },
  })

  const reversed: string[] = []
  for (const payment of payments) {
    try {
      if (await GATEWAYS[payment.gateway].isReversed(payment.gatewayPaymentId!)) reversed.push(payment.id)
    } catch (error) {
      console.error(`[payments] revalidate of ${payment.id} failed`, error instanceof Error ? error.message : error)
    }
  }
  if (reversed.length > 0) {
    await prisma.payment.updateMany({ where: { id: { in: reversed }, status: 'succeeded' }, data: { status: 'refunded' } })
    console.info(`[payments] ${reversed.length} payment(s) were refunded at the bank: ${reversed.join(', ')}`)
  }
}

const isRunning = (until: Date | null): until is Date => Boolean(until && until.getTime() > Date.now())

/**
 * Whether this owner's pass is running, asked by every PDF route: pending payments are settled
 * first (a tab closed mid-redirect), a running pass is re-checked for a refund. Returns the
 * payment a download counts against — the latest of the running window — or null.
 */
const runningPass = async (owner: ListOwner | null): Promise<{ paymentId: string } | null> => {
  if (!owner) return null
  await reconcileOwnerPayments(owner)
  const before = await windowOf(owner)
  if (!isRunning(before.until)) return null
  await revalidatePass(before.chain)
  const after = await windowOf(owner)
  if (!isRunning(after.until)) return null
  return { paymentId: after.chain[after.chain.length - 1].id }
}

/**
 * The print terms for this owner (null: a visitor with neither session nor guest key), and the
 * payment a clean print counts against — recorded as delivery evidence.
 */
export const printTermsFor = async (
  owner: ListOwner | null,
  templateId: TemplateId
): Promise<PrintTerms & { paymentId: string | null }> => {
  const pass = await runningPass(owner)
  return { ...printTerms({ templateId, active: Boolean(pass) }), paymentId: pass?.paymentId ?? null }
}
