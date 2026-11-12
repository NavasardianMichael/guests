import { describe, expect, it } from 'vitest'
import {
  AMERIA_BASE_URL,
  buildCancelBody,
  buildConfirmBody,
  buildInitPaymentBody,
  buildRefundBody,
  interpretDetails,
  isReversedPayment,
  paymentPageUrl,
  readInitResponse,
  readResultResponse,
} from '../../../server/src/services/gateways/ameria-wire'

const credentials = { clientId: 'client', username: 'user', password: 'secret' }

describe('Ameria InitPayment', () => {
  it('sends drams in AMD (ISO 4217 numeric 051) with our order number and return URL', () => {
    const body = buildInitPaymentBody(credentials, {
      orderId: 2350301,
      amount: 2000,
      description: 'Template',
      backUrl: 'https://api.example/payments/return/ameria',
      opaque: 'payment-id',
    })
    expect(body).toMatchObject({
      ClientID: 'client',
      Username: 'user',
      Password: 'secret',
      Currency: '051',
      OrderID: 2350301,
      Amount: 2000,
      BackURL: 'https://api.example/payments/return/ameria',
      Opaque: 'payment-id',
    })
  })

  it('reads ResponseCode 1 as success, anything else as failure', () => {
    expect(readInitResponse({ ResponseCode: 1, PaymentID: 'abc' })).toEqual({ ok: true, paymentId: 'abc' })
    expect(readInitResponse({ ResponseCode: '1', PaymentID: 'abc' })).toEqual({ ok: true, paymentId: 'abc' })
    expect(readInitResponse({ ResponseCode: 1, PaymentID: '' }).ok).toBe(false)
    expect(readInitResponse({ ResponseCode: 20, ResponseMessage: 'auth' }).ok).toBe(false)
  })

  it('builds the Armenian payment page URL', () => {
    expect(paymentPageUrl(AMERIA_BASE_URL.test, 'a b')).toBe('https://servicestest.ameriabank.am/VPOS/Payments/Pay?id=a%20b&lang=am')
  })
})

describe('Ameria GetPaymentDetails → verdict', () => {
  const expected = { orderId: 2350301, amount: 2000 }
  const deposited = { ResponseCode: '00', OrderStatus: '2', PaymentState: 'payment_deposited', OrderID: '2350301', Amount: 2000 }

  it('is paid only when deposited, for our order, for at least our amount', () => {
    expect(interpretDetails(deposited, expected)).toEqual({ status: 'succeeded' })
  })

  it('refuses a deposited payment for another order (a replayed paymentID)', () => {
    expect(interpretDetails({ ...deposited, OrderID: '999' }, expected)).toEqual({ status: 'failed', reason: 'order mismatch' })
  })

  it('refuses a smaller charge', () => {
    expect(interpretDetails({ ...deposited, Amount: 10 }, expected)).toEqual({ status: 'failed', reason: 'amount mismatch' })
  })

  it('treats declined, void and refunded as failed', () => {
    expect(interpretDetails({ ResponseCode: '00', OrderStatus: 6 }, expected).status).toBe('failed')
    expect(interpretDetails({ ResponseCode: '00', PaymentState: 'payment_void' }, expected).status).toBe('failed')
    expect(interpretDetails({ ResponseCode: '00', OrderStatus: '4' }, expected).status).toBe('failed')
  })

  it('keeps a started payment pending, marked as nothing charged', () => {
    const unpaid = { status: 'pending', nothingCharged: true }
    expect(interpretDetails({ ResponseCode: '00', OrderStatus: 0 }, expected)).toEqual(unpaid)
    expect(interpretDetails({ ResponseCode: '0-100', OrderStatus: '0', PaymentState: 'payment_started' }, expected)).toEqual(unpaid)
    expect(interpretDetails({ ResponseCode: '00', OrderStatus: '5', PaymentState: 'payment_autoauthorized' }, expected)).toEqual(unpaid)
  })

  it('keeps an unreadable or unconfirmed record plainly pending', () => {
    expect(interpretDetails({ ...deposited, ResponseCode: '01' }, expected)).toEqual({ status: 'pending' })
    // What the live server answered once for a bad request: no status at all.
    expect(interpretDetails({ Message: 'An error has occurred.' } as never, expected)).toEqual({ status: 'pending' })
  })

  describe('two-stage (OrderStatus 1, payment_approved)', () => {
    const approved = { ResponseCode: '00', OrderStatus: 1, PaymentState: 'payment_approved', OrderID: 2350301, ApprovedAmount: 2000, DepositedAmount: 0 }

    it('is approved — to be confirmed — when the blocked amount is ours', () => {
      expect(interpretDetails(approved, expected)).toEqual({ status: 'approved' })
    })

    it('is not confirmed for another order or a smaller block', () => {
      expect(interpretDetails({ ...approved, OrderID: 999 }, expected)).toEqual({ status: 'failed', reason: 'order mismatch' })
      expect(interpretDetails({ ...approved, ApprovedAmount: 10 }, expected)).toEqual({ status: 'failed', reason: 'amount mismatch' })
    })
  })
})

describe('Ameria GetPaymentDetails → reversed later (a refund in the bank panel)', () => {
  const deposited = { ResponseCode: '00', OrderStatus: '2', PaymentState: 'payment_deposited', Amount: 10, DepositedAmount: 10 }

  it('keeps a deposited payment paid', () => {
    expect(isReversedPayment({ ...deposited, RefundedAmount: 0 })).toBe(false)
  })

  it('takes back a refunded or voided one', () => {
    expect(isReversedPayment({ ...deposited, OrderStatus: '4', PaymentState: 'payment_refunded' })).toBe(true)
    expect(isReversedPayment({ ...deposited, OrderStatus: 3 })).toBe(true)
    expect(isReversedPayment({ ...deposited, PaymentState: 'payment_void' })).toBe(true)
  })

  it('takes back a full refund even while the status still says deposited, not a partial one', () => {
    expect(isReversedPayment({ ...deposited, RefundedAmount: 10 })).toBe(true)
    expect(isReversedPayment({ ...deposited, RefundedAmount: 4 })).toBe(false)
  })

  it('does not read a refusal to answer (bad credentials, unknown payment) as a refund', () => {
    expect(isReversedPayment({ ResponseCode: '20' })).toBe(false)
  })
})

describe('Ameria ConfirmPayment', () => {
  it('confirms the payment for our amount', () => {
    expect(buildConfirmBody(credentials, 'pay-1', 2000)).toEqual({ PaymentID: 'pay-1', Username: 'user', Password: 'secret', Amount: 2000 })
  })

  it('reads ResponseCode "00" as success, anything else as failure', () => {
    expect(readResultResponse('ConfirmPayment', { ResponseCode: '00' })).toEqual({ ok: true })
    expect(readResultResponse('ConfirmPayment', { ResponseCode: '0914', ResponseMessage: 'Orig trans not found' })).toEqual({
      ok: false,
      message: 'ConfirmPayment ResponseCode 0914: Orig trans not found',
    })
  })
})

describe('Ameria CancelPayment and RefundPayment', () => {
  it('cancels by PaymentID alone', () => {
    expect(buildCancelBody(credentials, 'pay-1')).toEqual({ PaymentID: 'pay-1', Username: 'user', Password: 'secret' })
  })

  it('refunds an amount', () => {
    expect(buildRefundBody(credentials, 'pay-1', 10)).toEqual({ PaymentID: 'pay-1', Username: 'user', Password: 'secret', Amount: 10 })
  })

  it('names the operation the bank refused', () => {
    expect(readResultResponse('RefundPayment', { ResponseCode: '513', ResponseMessage: null })).toEqual({
      ok: false,
      message: 'RefundPayment ResponseCode 513: no message',
    })
  })
})
