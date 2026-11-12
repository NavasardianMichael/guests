import { prisma } from '../lib/prisma.js'
import { type Reversal, reversePayment } from '../services/payments.js'
import { PASS_DAYS } from '../services/pricing.js'

/**
 * `pnpm payments:reverse <refund|cancel> <order number>…` — money back for settled payments
 * through the gateway's API (Ameria: RefundPayment, or CancelPayment within 72 hours). The
 * operator's tool; the app has no refund screen. Order numbers are `Payment.orderNumber`.
 * Each payment gets its own line, and one refusal does not stop the rest.
 */
const USAGE = 'usage: pnpm payments:reverse <refund|cancel> <order number>...'

const [kind, ...orders] = process.argv.slice(2)
if ((kind !== 'refund' && kind !== 'cancel') || orders.length === 0 || orders.some((order) => !/^\d+$/.test(order))) {
  console.error(USAGE)
  process.exit(1)
}

let failures = 0
for (const order of orders) {
  const payment = await prisma.payment.findUnique({ where: { orderNumber: Number(order) } })
  if (!payment) {
    console.error(`#${order}: no such payment`)
    failures += 1
    continue
  }
  try {
    await reversePayment(payment, kind as Reversal)
    console.log(`#${order}: ${kind} done (${payment.gateway} ${payment.gatewayPaymentId}) — its ${PASS_DAYS} days left the buyer's access`)
  } catch (error) {
    failures += 1
    console.error(`#${order}: ${kind} failed — ${error instanceof Error ? error.message : String(error)}`)
  }
}

await prisma.$disconnect()
process.exitCode = failures > 0 ? 1 : 0
