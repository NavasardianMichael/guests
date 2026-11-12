import { describe, expect, it } from 'vitest'
import { asClientInfo, describeUserAgent, type RequestInfo } from '../../../server/src/lib/request-info'
import { buildPaymentMail, formatDuration, type PaymentFacts } from '../../../server/src/services/paymentMail'

const UA = {
  chromeWindows:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  safariIphone:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
  chromeAndroid:
    'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36',
  samsungTablet:
    'Mozilla/5.0 (Linux; Android 13; SM-X700) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0.0.0 Safari/537.36',
  edgeMac:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0',
  facebookIphone:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/450.0]',
}

describe('describeUserAgent', () => {
  it('names browser, OS and device for the common cases', () => {
    expect(describeUserAgent(UA.chromeWindows)).toBe('Chrome 130 · Windows 10/11 · desktop')
    expect(describeUserAgent(UA.safariIphone)).toBe('Safari 17.4 · iOS 17.4 · mobile')
    expect(describeUserAgent(UA.chromeAndroid)).toBe('Chrome 130 · Android 14 · mobile')
    expect(describeUserAgent(UA.samsungTablet)).toBe('Samsung Internet 25 · Android 13 · tablet')
    expect(describeUserAgent(UA.edgeMac)).toBe('Edge 130 · macOS · desktop')
    expect(describeUserAgent(UA.facebookIphone)).toBe('Facebook in-app · iOS 17.4 · mobile')
  })

  it('says so when there is nothing to read', () => {
    expect(describeUserAgent(null)).toBe('unknown')
    expect(describeUserAgent('curl/8.4.0')).toBe('unknown browser · unknown OS · desktop')
  })
})

describe('asClientInfo', () => {
  it('keeps known keys as short strings and drops everything else', () => {
    expect(
      asClientInfo({ timezone: 'Asia/Yerevan', mobile: true, cores: 8, pixelRatio: Infinity, evil: 'x', screen: 'a'.repeat(500) })
    ).toEqual({ timezone: 'Asia/Yerevan', mobile: 'yes', cores: '8', screen: 'a'.repeat(100) })
  })

  it('is empty for anything that is not an object', () => {
    expect(asClientInfo(undefined)).toEqual({})
    expect(asClientInfo('x')).toEqual({})
    expect(asClientInfo(['timezone'])).toEqual({})
  })
})

const facts = (overrides: Partial<PaymentFacts> = {}): PaymentFacts => ({
  payment: {
    id: 'pay1',
    orderNumber: 42,
    amount: 2000,
    currency: 'AMD',
    gateway: 'ameria',
    gatewayTestMode: false,
    gatewayPaymentId: 'GW-1',
    status: 'pending',
    failureReason: null,
    createdAt: new Date('2026-11-06T10:00:00Z'),
    paidAt: null,
    attempt: 1,
    accessUntil: null,
  },
  buyer: {
    kind: 'account',
    id: 'u1',
    email: 'buyer@example.com',
    fullName: '<b>Աննա</b>',
    emailVerified: true,
    signIn: 'password',
    createdAt: new Date('2026-10-01T10:00:00Z'),
    listCount: 2,
    paidBefore: 0,
  },
  list: {
    id: 'list1',
    title: '<img src=x> Մեր հարսանիքը',
    templateId: 'memorial',
    kind: 'seating',
    guestCount: 120,
    tableCount: 12,
    heading: 'Աննա և Արամ',
    subheading: '',
    createdAt: new Date('2026-11-05T10:00:00Z'),
    updatedAt: new Date('2026-11-06T09:59:00Z'),
  },
  ...overrides,
})

const request: RequestInfo = {
  ip: '203.0.113.7',
  userAgent: UA.chromeAndroid,
  acceptLanguage: 'hy-AM,hy;q=0.9',
  clientHints: 'Google Chrome 130 · Android · mobile',
  referer: null,
  client: { timezone: 'Asia/Yerevan', screen: '412×915' },
}

describe('buildPaymentMail', () => {
  it('keeps visitor text out of the subject and sender, which the engine does not escape', () => {
    for (const event of ['started', 'succeeded'] as const) {
      const mail = buildPaymentMail(event, facts(), request)
      expect(mail.subject).not.toMatch(/[<>]|Աննա|հարսանիք/)
      expect(mail.firstName).toMatch(/^(Checkout|Payment)$/)
      expect(mail.senderEmail).toBeUndefined()
    }
  })

  it('describes the click: order, buyer, list and device', () => {
    const mail = buildPaymentMail('started', facts(), request)
    expect(mail.subject).toBe('Checkout started · order #42 · 2,000 AMD')
    expect(mail.details).toMatchObject({
      'Order #': '42',
      'Gateway answer': 'payment page opened; buyer sent to the bank',
      'Buyer email': 'buyer@example.com',
      'Paid before': 'never — first purchase',
      'List title': '<img src=x> Մեր հարսանիքը',
      Guests: '120',
      Tables: '12',
      'Heading on the sheet': 'Աննա և Արամ',
      Device: 'Chrome 130 · Android 14 · mobile',
      IP: '203.0.113.7',
      Timezone: 'Asia/Yerevan',
      Screen: '412×915',
    })
    expect(mail.details).not.toHaveProperty('Line under it')
  })

  it('says when the bank page never opened', () => {
    const failed = facts()
    failed.payment.status = 'failed'
    failed.payment.failureReason = 'ResponseCode 0'
    const mail = buildPaymentMail('started', failed, request)
    expect(mail.subject).toBe('Checkout FAILED to start · order #42')
    expect(mail.details?.['Gateway answer']).toContain('ResponseCode 0')
  })

  it('tells a paid guest apart, with when and how it was confirmed', () => {
    const paid = facts({ buyer: { kind: 'guest', guestListCount: 1, paidBefore: 1 } })
    paid.payment.status = 'succeeded'
    paid.payment.paidAt = new Date('2026-11-06T10:03:30Z')
    const mail = buildPaymentMail('succeeded', paid, request, 'access')
    expect(mail.subject).toBe('Payment succeeded · order #42 · 2,000 AMD')
    expect(mail.details).toMatchObject({
      Buyer: 'guest — no account',
      'Paid before': '1 payment(s)',
      'Time to pay': '3m 30s',
      Confirmed: expect.stringContaining("buyer's access was read"),
    })
    expect(mail.details).toHaveProperty(['— Device (confirming request) —'])
  })

  it('says until when the bought access runs', () => {
    const paid = facts()
    paid.payment.status = 'succeeded'
    paid.payment.paidAt = new Date('2026-11-06T10:03:30Z')
    paid.payment.accessUntil = new Date('2026-11-27T10:03:30Z')
    const mail = buildPaymentMail('succeeded', paid, request, 'return')
    expect(mail.body).toContain('21 days of full access')
    expect(mail.details?.['Full access until']).toContain('27 Nov 2026')
  })

  it('still sends when there is no saved list and no request is known', () => {
    const mail = buildPaymentMail('succeeded', facts({ list: null }), null, 'return')
    expect(mail.details?.List).toContain('unsaved draft')
    expect(mail.details).not.toHaveProperty('IP')
  })
})

describe('formatDuration', () => {
  it('reads at a glance', () => {
    expect(formatDuration(42_000)).toBe('42s')
    expect(formatDuration(3 * 3600_000 + 5 * 60_000)).toBe('3h 5m')
    expect(formatDuration(50 * 3600_000)).toBe('2d 2h')
  })
})
