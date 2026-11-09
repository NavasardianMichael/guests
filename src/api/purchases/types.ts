import type { Endpoint } from '@interfaces/api'

export type PaymentStatus = 'pending' | 'succeeded' | 'failed' | 'refunded'

/** `accessUntil`: ISO, in the past once it ran out, null if never bought. `payment`: the asked payment's status. */
export type AccessResponse = { accessUntil: string | null; payment: PaymentStatus | null }
/** `until` in epoch ms. */
export type Access = { until: number | null; payment: PaymentStatus | null }
export type GetAccessAPI = Endpoint<{ payload: { paymentId?: string } | void; response: AccessResponse; processed: Access }>

/** `listId`: the saved list the purchase starts from (the result page leads back to it); absent for a draft. */
export type CheckoutPayload = { listId?: string }
export type CheckoutResponse = { checkoutUrl: string }
export type CheckoutAPI = Endpoint<{ payload: CheckoutPayload; response: CheckoutResponse; processed: string }>
