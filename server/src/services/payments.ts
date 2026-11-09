import type { Payment, PaymentStatus, Prisma } from '@prisma/client'
import { type PrintTerms, printTerms } from './entitlement.js'
import { GATEWAYS } from './gateways/index.js'
import { TEMPLATE_PRICE_AMD } from './pricing.js'
import { config } from '../config.js'
import { FREE_TEMPLATE_IDS, isTemplateId, type TemplateId } from '../lib/catalogue.js'
import { ERROR_CODE } from '../lib/error-codes.js'
import { prisma } from '../lib/prisma.js'
import type { ListOwner } from '../middleware/auth.js'
import { HttpError } from '../middleware/error.js'

/**
 * One-time template purchases (docs/PAYMENTS.md). cv-builder's flow, with one difference: what
 * is bought is a **template**, not a document. A `succeeded` payment is its owner's licence to
 * print that template on every list they have or make; nothing else records it.
 *
 * - `startCheckout` writes a `pending` Payment, asks the gateway for a payment page, and
 *   returns its URL. Nothing is unlocked here.
 * - `settlePayment` is the **only** writer of `succeeded`. It asks the gateway, server to
 *   server, and moves the row out of `pending` by compare-and-set, so the return redirect, a
 *   page reload and a reconcile racing each other settle it once.
 * - `reconcileOwnerPayments` covers the buyer who paid and closed the tab before the redirect:
 *   reading the owner's templates, or printing, re-checks their recent pending payments.
 *   Computed on read, no background job.
 * - `revalidateLicence` takes a refunded template back before it prints again.
 */

const RECONCILE_WINDOW_MS = 3 * 24 * 60 * 60 * 1000

/** A payment owned by this account or guest key: `ListOwner` is that `where` fragment as it is. */
const ownedBy = (owner: ListOwner): Prisma.PaymentWhereInput => owner

/** The premium templates this owner holds. Free templates need no purchase and are not listed. */
export const ownedTemplateIds = async (owner: ListOwner): Promise<TemplateId[]> => {
  const rows = await prisma.payment.findMany({
    where: { ...ownedBy(owner), status: 'succeeded' },
    select: { templateId: true },
    distinct: ['templateId'],
  })
  return rows.map((row) => row.templateId).filter(isTemplateId)
}

const holds = async (owner: ListOwner, templateId: TemplateId): Promise<boolean> =>
  (await prisma.payment.count({ where: { ...ownedBy(owner), templateId, status: 'succeeded' } })) > 0

/**
 * Starts buying `templateId` for this owner and returns the bank page's URL. `listId` is only
 * where the buyer started (the result page links back to it) and must already be the owner's.
 */
export const startCheckout = async (
  owner: ListOwner,
  input: { templateId: TemplateId; listId: string | null }
): Promise<string> => {
  if (FREE_TEMPLATE_IDS.includes(input.templateId)) {
    throw new HttpError(409, 'This template is free', ERROR_CODE.templateAlreadyOwned)
  }
  if (await holds(owner, input.templateId)) {
    throw new HttpError(409, 'This template is already bought', ERROR_CODE.templateAlreadyOwned)
  }

  const gatewayId = config.payments.gateway
  const gateway = GATEWAYS[gatewayId]

  const payment = await prisma.payment.create({
    data: {
      ...owner,
      templateId: input.templateId,
      listId: input.listId,
      amount: TEMPLATE_PRICE_AMD,
      gateway: gatewayId,
    },
  })

  try {
    const { gatewayPaymentId, redirectUrl } = await gateway.init({
      orderNumber: payment.orderNumber,
      amount: payment.amount,
      description: `Իմ հյուրերը — ձևանմուշ «${input.templateId}»`,
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

/**
 * Re-checks this owner's recent pending payments — of one template, or of all. Gateway
 * failures are logged, never thrown at a reader.
 */
export const reconcileOwnerPayments = async (owner: ListOwner, templateId?: TemplateId): Promise<void> => {
  const pending = await prisma.payment.findMany({
    where: {
      ...ownedBy(owner),
      ...(templateId ? { templateId } : {}),
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
 * Whether a bought template is still bought, asked before it prints: a refund or void made
 * later in the bank's panel takes the template back. Each `succeeded` payment for it is
 * re-read from its gateway, and a reversed one becomes `refunded`; the template stays the
 * owner's while one is left (bought twice, refunded once). A gateway that cannot answer counts
 * as still paid — an outage must not lock a buyer out.
 */
const revalidateLicence = async (owner: ListOwner, templateId: TemplateId): Promise<boolean> => {
  const payments = await prisma.payment.findMany({
    where: { ...ownedBy(owner), templateId, status: 'succeeded', gatewayPaymentId: { not: null } },
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
    console.info(`[payments] ${reversed.length} payment(s) for template ${templateId} were refunded at the bank`)
  }
  return holds(owner, templateId)
}

/**
 * Whether this owner may print `templateId` clean, asked by every PDF route before printing a
 * premium template: a pending payment is settled first (a tab closed mid-redirect), a held
 * one is re-checked for a refund. Returns the payment a download counts against, or null.
 */
const printLicence = async (owner: ListOwner | null, templateId: TemplateId): Promise<{ paymentId: string } | null> => {
  if (!owner) return null
  if (await holds(owner, templateId)) {
    if (!(await revalidateLicence(owner, templateId))) return null
  } else {
    await reconcileOwnerPayments(owner, templateId)
  }
  // Two succeeded payments are a double charge; a download counts against the latest.
  const payment = await prisma.payment.findFirst({
    where: { ...ownedBy(owner), templateId, status: 'succeeded' },
    orderBy: { paidAt: 'desc' },
    select: { id: true },
  })
  return payment ? { paymentId: payment.id } : null
}

/**
 * The print terms for this owner (null: a visitor with neither session nor guest key), and the
 * payment a clean print counts against — recorded as delivery evidence. The free template
 * never asks the bank.
 */
export const printTermsFor = async (
  owner: ListOwner | null,
  templateId: TemplateId
): Promise<PrintTerms & { paymentId: string | null }> => {
  if (FREE_TEMPLATE_IDS.includes(templateId)) return { ...printTerms({ templateId, owned: false }), paymentId: null }
  const licence = await printLicence(owner, templateId)
  return { ...printTerms({ templateId, owned: Boolean(licence) }), paymentId: licence?.paymentId ?? null }
}
