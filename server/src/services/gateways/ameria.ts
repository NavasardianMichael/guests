import {
  AMERIA_BASE_URL,
  type AmeriaConfirmResponse,
  type AmeriaDetailsResponse,
  type AmeriaInitResponse,
  buildConfirmBody,
  buildDetailsBody,
  buildInitPaymentBody,
  interpretDetails,
  isReversedPayment,
  paymentPageUrl,
  readConfirmResponse,
  readInitResponse,
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

  async check(gatewayPaymentId, expected) {
    const target = { orderId: orderIdOf(expected.orderNumber), amount: chargeOf(expected.amount) }
    const readDetails = async () =>
      interpretDetails(
        await post<AmeriaDetailsResponse>('GetPaymentDetails', buildDetailsBody(credentials(), gatewayPaymentId)),
        target
      )

    const verdict = await readDetails()
    if (verdict.status !== 'approved') return verdict

    // A two-stage terminal only blocked the amount; ConfirmPayment charges it. The verdict
    // still comes from the bank's record, read again, not from the confirmation's answer.
    const confirmed = readConfirmResponse(
      await post<AmeriaConfirmResponse>('ConfirmPayment', buildConfirmBody(credentials(), gatewayPaymentId, target.amount))
    )
    if (!confirmed.ok) throw new GatewayError(confirmed.message)
    const after = await readDetails()
    return after.status === 'approved' ? { status: 'pending' } : after
  },

  async isReversed(gatewayPaymentId) {
    return isReversedPayment(
      await post<AmeriaDetailsResponse>('GetPaymentDetails', buildDetailsBody(credentials(), gatewayPaymentId))
    )
  },
}
