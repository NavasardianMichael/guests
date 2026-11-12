import { type GatewayVerdict, PAYMENT_PAGE_TIMEOUT_SECONDS } from './types.js'

/**
 * Ameriabank vPOS 3.1 (REST, JSON) — the request and response shapes. Pure and import-free
 * so `tests/unit/server/ameria.spec.ts` can pin them. The I/O half is `ameria.ts`.
 *
 * Reference: the bank's "vPOS 3.1 API protocol" PDF (from vpos.support@ameriabank.am) and
 * its help page at https://servicestest.ameriabank.am/VPOS/help. Facts this relies on:
 *
 * - Base: `https://servicestest.ameriabank.am/VPOS/` (test), `https://services.ameriabank.am/VPOS/`.
 * - `POST api/VPOS/InitPayment` takes ClientID + Username + Password; answers `PaymentID` and
 *   `ResponseCode` **1** (a number) on success.
 * - The buyer pays at `Payments/Pay?id=<PaymentID>&lang=am`, then is sent to `BackURL` with
 *   `orderID`, `paymentID`, `opaque` and `resposneCode` (sic — the bank's spelling).
 * - `POST api/VPOS/GetPaymentDetails` takes Username + Password + PaymentID; answers
 *   `ResponseCode` **"00"** on success, `OrderStatus` 2 / `PaymentState` "payment_deposited"
 *   for a completed one-step payment, 6 / "payment_declined" for a declined one.
 * - A two-stage terminal stops at `OrderStatus` 1 / "payment_approved": the amount is only
 *   blocked on the card until `POST api/VPOS/ConfirmPayment` (PaymentID + Username + Password
 *   + Amount) charges it; that answers `ResponseCode` **"00"** on success.
 * - Money back, both answering `ResponseCode` **"00"**: `POST api/VPOS/CancelPayment` (PaymentID +
 *   Username + Password; only within 72 hours of InitPayment) and `POST api/VPOS/RefundPayment`
 *   (the same + Amount, at most the transaction amount).
 * - Currency is ISO 4217 numeric: AMD = "051". Amount is a decimal number of drams.
 */

export const AMERIA_BASE_URL = {
  test: 'https://servicestest.ameriabank.am/VPOS/',
  live: 'https://services.ameriabank.am/VPOS/',
} as const

export const AMERIA_CURRENCY_AMD = '051'

export type AmeriaCredentials = { clientId: string; username: string; password: string }

export type AmeriaInitResponse = {
  PaymentID?: string | null
  ResponseCode?: number | string | null
  ResponseMessage?: string | null
}

export type AmeriaDetailsResponse = {
  ResponseCode?: string | number | null
  OrderID?: string | number | null
  Amount?: number | string | null
  ApprovedAmount?: number | string | null
  DepositedAmount?: number | string | null
  RefundedAmount?: number | string | null
  OrderStatus?: string | number | null
  PaymentState?: string | null
  Description?: string | null
  TrxnDescription?: string | null
}

export type AmeriaResultResponse = {
  ResponseCode?: string | number | null
  ResponseMessage?: string | null
  Opaque?: string | null
}

/** A gateway verdict; `approved` is the "blocked, not yet charged" of a two-stage terminal. */
export type AmeriaVerdict = GatewayVerdict

export const buildInitPaymentBody = (
  credentials: AmeriaCredentials,
  input: { orderId: number; amount: number; description: string; backUrl: string; opaque: string }
) => ({
  ClientID: credentials.clientId,
  Username: credentials.username,
  Password: credentials.password,
  Currency: AMERIA_CURRENCY_AMD,
  Description: input.description.slice(0, 250),
  OrderID: input.orderId,
  Amount: input.amount,
  BackURL: input.backUrl,
  Opaque: input.opaque,
  // Seconds the payment page stays valid.
  Timeout: PAYMENT_PAGE_TIMEOUT_SECONDS,
})

export const buildDetailsBody = (credentials: AmeriaCredentials, paymentId: string) => ({
  PaymentID: paymentId,
  Username: credentials.username,
  Password: credentials.password,
})

export const buildConfirmBody = (credentials: AmeriaCredentials, paymentId: string, amount: number) => ({
  PaymentID: paymentId,
  Username: credentials.username,
  Password: credentials.password,
  Amount: amount,
})

/** CancelPayment: within 72 hours of InitPayment; reverses the payment. */
export const buildCancelBody = (credentials: AmeriaCredentials, paymentId: string) => ({
  PaymentID: paymentId,
  Username: credentials.username,
  Password: credentials.password,
})

/** RefundPayment: `Amount` back to the card, at most the transaction amount. */
export const buildRefundBody = (credentials: AmeriaCredentials, paymentId: string, amount: number) => ({
  PaymentID: paymentId,
  Username: credentials.username,
  Password: credentials.password,
  Amount: amount,
})

export const paymentPageUrl = (baseUrl: string, paymentId: string): string =>
  `${baseUrl}Payments/Pay?id=${encodeURIComponent(paymentId)}&lang=am`

/** `ResponseCode` 1 (number, or "1" in some representations) with a PaymentID. */
export const readInitResponse = (body: AmeriaInitResponse): { ok: true; paymentId: string } | { ok: false; message: string } => {
  const code = body.ResponseCode
  if ((code === 1 || code === '1') && typeof body.PaymentID === 'string' && body.PaymentID) {
    return { ok: true, paymentId: body.PaymentID }
  }
  return { ok: false, message: `InitPayment ResponseCode ${String(code)}: ${body.ResponseMessage ?? 'no message'}` }
}

/** ConfirmPayment, CancelPayment and RefundPayment all answer `ResponseCode` "00" on success. */
export const readResultResponse = (
  operation: 'ConfirmPayment' | 'CancelPayment' | 'RefundPayment',
  body: AmeriaResultResponse
): { ok: true } | { ok: false; message: string } =>
  String(body.ResponseCode ?? '') === '00'
    ? { ok: true }
    : {
        ok: false,
        message: `${operation} ResponseCode ${String(body.ResponseCode ?? '') || '(empty)'}: ${body.ResponseMessage || 'no message'}`,
      }

const asNumber = (value: unknown): number | null => {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN
  return Number.isFinite(parsed) ? parsed : null
}

/**
 * The settlement decision. Paid only when the bank says deposited **and** the order number
 * and amount are the ones we asked for — a details record for some other order (a replayed
 * `paymentID`) or a smaller charge must not unlock anything. `approved` (blocked on the card,
 * two-stage) passes the same checks against the blocked amount before it may be confirmed.
 */
export const interpretDetails = (
  body: AmeriaDetailsResponse,
  expected: { orderId: number; amount: number }
): AmeriaVerdict => {
  const status = asNumber(body.OrderStatus)
  const state = body.PaymentState ?? ''
  const responseOk = String(body.ResponseCode ?? '') === '00'

  if (status === 6 || state === 'payment_declined') return { status: 'failed', reason: 'declined' }
  if (status === 3 || status === 4 || state === 'payment_void' || state === 'payment_refunded') {
    return { status: 'failed', reason: state || `status ${status}` }
  }

  // 0 / "payment_started": registered, no card entered yet. 5 / "payment_autoauthorized":
  // 3-D Secure began but did not authorise. Either way no money has moved.
  if (status === 0 || status === 5 || state === 'payment_started' || state === 'payment_autoauthorized') {
    return { status: 'pending', nothingCharged: true }
  }

  const deposited = status === 2 || state === 'payment_deposited'
  const approved = status === 1 || state === 'payment_approved'
  if (!(deposited || approved) || !responseOk) return { status: 'pending' }

  if (asNumber(body.OrderID) !== expected.orderId) return { status: 'failed', reason: 'order mismatch' }
  const charged = deposited
    ? (asNumber(body.DepositedAmount) ?? asNumber(body.ApprovedAmount) ?? asNumber(body.Amount))
    : asNumber(body.ApprovedAmount)
  if (charged === null || charged < expected.amount) return { status: 'failed', reason: 'amount mismatch' }

  return { status: deposited ? 'succeeded' : 'approved' }
}

/**
 * Whether a settled payment was taken back later, in the bank's merchant panel: `OrderStatus`
 * 4 / "payment_refunded" or 3 / "payment_void", or `RefundedAmount` reaching what was charged.
 * A partial refund keeps it paid. A record the bank could not give (no status, no refund) is
 * not a reversal.
 */
export const isReversedPayment = (body: AmeriaDetailsResponse): boolean => {
  const status = asNumber(body.OrderStatus)
  const state = body.PaymentState ?? ''
  if (status === 3 || status === 4 || state === 'payment_void' || state === 'payment_refunded') return true
  const refunded = asNumber(body.RefundedAmount) ?? 0
  const charged = asNumber(body.DepositedAmount) ?? asNumber(body.Amount) ?? 0
  return refunded > 0 && refunded >= charged
}
