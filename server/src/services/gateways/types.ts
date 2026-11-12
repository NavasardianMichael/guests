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

/**
 * How long a gateway's payment page stays payable, sent with every payment (Ameria's
 * `Timeout`; at most 1200). Past it the bank declines the order by itself.
 */
export const PAYMENT_PAGE_TIMEOUT_SECONDS = 1200

export type GatewayInitResult = {
  gatewayPaymentId: string
  redirectUrl: string
}

export type GatewayVerdict =
  | { status: 'succeeded' }
  /**
   * Two-stage terminals only: the amount is blocked on the card, not taken. `settlePayment`
   * then `confirm`s it, and only the record read after that settles it.
   */
  | { status: 'approved' }
  /**
   * `nothingCharged`: the gateway's record says the buyer has not paid (yet) — the payment was
   * registered but no card went through. Still pending: they may go back and pay. Without
   * it, a charge may be under way (a two-stage confirmation, a record we could not read).
   */
  | { status: 'pending'; nothingCharged?: true }
  | { status: 'failed'; reason: string }

export type PaymentGatewayClient = {
  init(input: GatewayInitInput): Promise<GatewayInitResult>
  /**
   * The gateway's own answer for one payment, checked against what we asked it to charge.
   * Reads only: it never moves money.
   */
  check(gatewayPaymentId: string, expected: { orderNumber: number; amount: number }): Promise<GatewayVerdict>
  /** The payment page of a payment already started (the one `init` answered), to send the buyer back to. */
  pageUrl(gatewayPaymentId: string): string
  /**
   * Charges an `approved` (blocked) payment, then answers the gateway's record read again:
   * `succeeded` once it shows charged, `pending` while it does not yet. Throws on a refusal.
   */
  confirm(gatewayPaymentId: string, expected: { orderNumber: number; amount: number }): Promise<GatewayVerdict>
  /**
   * Money back for a settled payment, an operator's action (`pnpm payments:reverse`): `refund`
   * the whole charge, or `cancel` it (Ameria: within 72 hours). Throw when the gateway refuses.
   */
  refund(gatewayPaymentId: string, amount: number): Promise<void>
  cancel(gatewayPaymentId: string): Promise<void>
  /** True when a settled payment has been refunded or voided since. Throws when the gateway cannot answer. */
  isReversed(gatewayPaymentId: string): Promise<boolean>
}

export class GatewayError extends Error {}
