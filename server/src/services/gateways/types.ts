/**
 * What a payment gateway must do for a one-time purchase. Every gateway redirects the buyer
 * to its own page and back to `backUrl`; the return trip is **never** trusted — the payment
 * is settled only from `check`, a server-to-server read of the gateway's own record.
 */
export type GatewayInitInput = {
  /** `Payment.orderNumber`; a gateway may add its own offset. */
  orderNumber: number
  /** Whole drams, the catalogue price. A gateway may charge an override in test mode. */
  amount: number
  description: string
  backUrl: string
  /** Echoed back on the return trip; carries our `Payment.id`. */
  opaque: string
}

export type GatewayInitResult = {
  gatewayPaymentId: string
  redirectUrl: string
}

export type GatewayVerdict =
  | { status: 'succeeded' }
  | { status: 'pending' }
  | { status: 'failed'; reason: string }

export type PaymentGatewayClient = {
  init(input: GatewayInitInput): Promise<GatewayInitResult>
  /** The gateway's own answer for one payment, checked against what we asked it to charge. */
  check(gatewayPaymentId: string, expected: { orderNumber: number; amount: number }): Promise<GatewayVerdict>
  /** True when a settled payment has been refunded or voided since. Throws when the gateway cannot answer. */
  isReversed(gatewayPaymentId: string): Promise<boolean>
}

export class GatewayError extends Error {}
