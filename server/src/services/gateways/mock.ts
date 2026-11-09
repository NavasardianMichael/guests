import { randomUUID } from 'node:crypto'
import type { GatewayVerdict, PaymentGatewayClient } from './types.js'
import { config } from '../../config.js'

/**
 * A stand-in for a bank, for local development: `init` points the buyer at a page this API
 * serves (`GET /payments/mock/:id`, in `routes/payments.ts`) with Pay and Decline buttons.
 * State is in memory, so a restart forgets unfinished payments. `isPaymentConfigured()`
 * refuses this gateway in production.
 */
type MockPayment = { orderNumber: number; amount: number; backUrl: string; opaque: string; verdict: GatewayVerdict }

const payments = new Map<string, MockPayment>()

export const mockGateway: PaymentGatewayClient = {
  async init(input) {
    const id = randomUUID()
    payments.set(id, {
      orderNumber: input.orderNumber,
      amount: input.amount,
      backUrl: input.backUrl,
      opaque: input.opaque,
      verdict: { status: 'pending' },
    })
    return { gatewayPaymentId: id, redirectUrl: `${config.apiPublicUrl}/payments/mock/${id}` }
  },

  async check(gatewayPaymentId, expected) {
    const payment = payments.get(gatewayPaymentId)
    if (!payment) return { status: 'failed', reason: 'unknown mock payment' }
    if (payment.orderNumber !== expected.orderNumber || payment.amount !== expected.amount) {
      return { status: 'failed', reason: 'order mismatch' }
    }
    return payment.verdict
  },

  // The mock bank has no refunds.
  async isReversed() {
    return false
  },
}

export const readMockPayment = (id: string): MockPayment | undefined => payments.get(id)

/** The buyer's click on the mock page. Returns the back URL, as a bank's redirect would. */
export const decideMockPayment = (id: string, approve: boolean): string | null => {
  const payment = payments.get(id)
  if (!payment) return null
  payment.verdict = approve ? { status: 'succeeded' } : { status: 'failed', reason: 'declined' }
  const url = new URL(payment.backUrl)
  url.searchParams.set('paymentID', id)
  url.searchParams.set('orderID', String(payment.orderNumber))
  url.searchParams.set('opaque', payment.opaque)
  return url.toString()
}
