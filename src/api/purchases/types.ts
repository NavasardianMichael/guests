import type { Endpoint } from '@interfaces/api'
import type { ClientInfo } from '@helpers/clientInfo'

export type PaymentStatus = 'pending' | 'succeeded' | 'failed' | 'refunded'

/** `accessUntil`: ISO, in the past once it ran out, null if never bought. `payment`: the asked payment's status. */
export type AccessResponse = { accessUntil: string | null; payment: PaymentStatus | null }
/** `until` in epoch ms. */
export type Access = { until: number | null; payment: PaymentStatus | null }
export type GetAccessAPI = Endpoint<{ payload: { paymentId?: string } | void; response: AccessResponse; processed: Access }>

/**
 * `listId`: the saved list the purchase starts from (the result page leads back to it); absent
 * for a draft. `client`: the device facts for the admin's "checkout started" mail
 * (`@helpers/clientInfo`). `resume`: the buyer chose to continue an open attempt — sent to its
 * own bank page (a new one if it cannot be resumed).
 */
export type CheckoutPayload = { listId?: string; client: ClientInfo; resume?: true }
/**
 * The bank's page to go to, or — no payment started — an earlier attempt whose bank page may
 * still be open in another tab, started `minutesAgo` (by the server's clock).
 */
export type CheckoutResponse = { redirectUrl: string } | { openPayment: { minutesAgo: number } }
export type CheckoutResult = { kind: 'redirect'; url: string } | { kind: 'open'; minutesAgo: number }
export type CheckoutAPI = Endpoint<{ payload: CheckoutPayload; response: CheckoutResponse; processed: CheckoutResult }>
