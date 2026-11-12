import {
  AMERIA_BASE_URL,
  type AmeriaDetailsResponse,
  type AmeriaInitResponse,
  type AmeriaResultResponse,
  buildCancelBody,
  buildConfirmBody,
  buildDetailsBody,
  buildInitPaymentBody,
  buildRefundBody,
  interpretDetails,
  isReversedPayment,
  paymentPageUrl,
  readInitResponse,
  readResultResponse,
} from './ameria-wire.js'
import { GatewayError, type PaymentGatewayClient } from './types.js'
import { config } from '../../config.js'

/**
 * Ameriabank vPOS client. The only reader of the AMERIA_* credentials; they go in request
 * bodies (the protocol's choice) and are never logged — a failure logs the bank's code and
 * message only.
 */
const REQUEST_TIMEOUT_MS = 20_000

const settings = () => config.payments.ameria
const baseUrl = (): string => (settings().testMode ? AMERIA_BASE_URL.test : AMERIA_BASE_URL.live)
const credentials = () => ({ clientId: settings().clientId, username: settings().username, password: settings().password })
const orderIdOf = (orderNumber: number): number => settings().orderIdOffset + orderNumber
const chargeOf = (amount: number): number => settings().amountOverride ?? amount

const post = async <T>(operation: string, body: object): Promise<T> => {
  let response: Response
  try {
    response = await fetch(`${baseUrl()}api/VPOS/${operation}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8', Accept: 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
  } catch (error) {
    throw new GatewayError(`Ameria ${operation} did not complete: ${error instanceof Error ? error.message : 'unknown'}`)
  }
  if (!response.ok) throw new GatewayError(`Ameria ${operation} answered HTTP ${response.status}`)
  return (await response.json()) as T
}

/**
 * Without the bank's reverse/refund permission both calls are refused (codes 514 / 513), so
 * they are not sent at all: the caller's "return it by hand" path takes over at once.
 */
const assertReversalsOn = (): void => {
  if (!settings().apiReversals) {
    throw new GatewayError('API reversals are off (AMERIA_API_REVERSALS): return the money in the Ameria dashboard')
  }
}

const readDetails = async (gatewayPaymentId: string, expected: { orderNumber: number; amount: number }) =>
  interpretDetails(
    await post<AmeriaDetailsResponse>('GetPaymentDetails', buildDetailsBody(credentials(), gatewayPaymentId)),
    { orderId: orderIdOf(expected.orderNumber), amount: chargeOf(expected.amount) }
  )

export const ameriaGateway: PaymentGatewayClient = {
  async init(input) {
    const body = buildInitPaymentBody(credentials(), {
      orderId: orderIdOf(input.orderNumber),
      amount: chargeOf(input.amount),
      description: input.description,
      backUrl: input.backUrl,
      opaque: input.opaque,
    })
    const answer = readInitResponse(await post<AmeriaInitResponse>('InitPayment', body))
    if (!answer.ok) throw new GatewayError(answer.message)
    return { gatewayPaymentId: answer.paymentId, redirectUrl: paymentPageUrl(baseUrl(), answer.paymentId) }
  },

  pageUrl(gatewayPaymentId) {
    return paymentPageUrl(baseUrl(), gatewayPaymentId)
  },

  async check(gatewayPaymentId, expected) {
    return readDetails(gatewayPaymentId, expected)
  },

  // A two-stage terminal only blocked the amount; ConfirmPayment charges it. The verdict
  // still comes from the bank's record, read again, not from the confirmation's answer.
  async confirm(gatewayPaymentId, expected) {
    const confirmed = readResultResponse(
      'ConfirmPayment',
      await post<AmeriaResultResponse>(
        'ConfirmPayment',
        buildConfirmBody(credentials(), gatewayPaymentId, chargeOf(expected.amount))
      )
    )
    if (!confirmed.ok) throw new GatewayError(confirmed.message)
    const after = await readDetails(gatewayPaymentId, expected)
    return after.status === 'approved' ? { status: 'pending' } : after
  },

  async refund(gatewayPaymentId, amount) {
    assertReversalsOn()
    const answer = readResultResponse(
      'RefundPayment',
      await post<AmeriaResultResponse>('RefundPayment', buildRefundBody(credentials(), gatewayPaymentId, chargeOf(amount)))
    )
    if (!answer.ok) throw new GatewayError(answer.message)
  },

  async cancel(gatewayPaymentId) {
    assertReversalsOn()
    const answer = readResultResponse(
      'CancelPayment',
      await post<AmeriaResultResponse>('CancelPayment', buildCancelBody(credentials(), gatewayPaymentId))
    )
    if (!answer.ok) throw new GatewayError(answer.message)
  },

  async isReversed(gatewayPaymentId) {
    return isReversedPayment(
      await post<AmeriaDetailsResponse>('GetPaymentDetails', buildDetailsBody(credentials(), gatewayPaymentId))
    )
  },
}
