import { PASS_DAYS } from './pricing.js'
import type { InternalMailPayload } from '../lib/mail.js'
import { type ClientInfoKey, describeUserAgent, type RequestInfo } from '../lib/request-info.js'

/**
 * The two internal mails about a purchase, built from plain facts so they are testable
 * without a database; `paymentNotifications.ts` loads the facts and sends. As cv-builder's.
 *
 * **Visitor text goes only into `body` and `details`.** The engine sanitises those two but
 * inserts `subject` and the sender name into its HTML as they are, and turns `senderEmail`
 * into Reply-To — so the subject and sender are fixed strings with numbers, and the buyer's
 * name, email and list title travel in `details`.
 */

export type PaymentMailEvent = 'started' | 'succeeded'

/**
 * How a payment got settled: the bank's redirect, or reconcile-on-read
 * (`reconcileOwnerPayments`) when the buyer's access was read, a PDF was printed, a photo was
 * read, or another checkout was started.
 */
export type SettleSource = 'return' | 'access' | 'pdf-download' | 'photo' | 'checkout'

export type BuyerFacts =
  | {
      kind: 'account'
      id: string
      email: string
      fullName: string
      emailVerified: boolean
      signIn: string
      createdAt: Date
      listCount: number
      /** Settled payments of this account other than this one. */
      paidBefore: number
    }
  | { kind: 'guest'; guestListCount: number; paidBefore: number }

export type PaymentFacts = {
  payment: {
    id: string
    orderNumber: number
    amount: number
    currency: string
    gateway: string
    gatewayTestMode: boolean
    gatewayPaymentId: string | null
    status: string
    failureReason: string | null
    createdAt: Date
    paidAt: Date | null
    /** 1 for this buyer's first checkout. */
    attempt: number
    /** When the buyer's full access ends with this payment counted; null before it settles. */
    accessUntil: Date | null
  }
  buyer: BuyerFacts
  /** The list the purchase started from. Null for a guest's unsaved draft, or once it was deleted (the payment outlives it). */
  list: {
    id: string
    title: string
    templateId: string
    kind: string
    guestCount: number
    tableCount: number
    /** From the list's own text: the sheet's title and the line under it (names, date, venue). */
    heading: string
    subheading: string
    createdAt: Date
    updatedAt: Date
  } | null
}

const SOURCE_LABEL: Record<SettleSource, string> = {
  return: 'the bank redirected the buyer back to the site',
  access: "reconciled when the buyer's access was read: editor, dashboard or result page (no bank redirect seen)",
  'pdf-download': 'reconciled when the buyer downloaded a PDF (no bank redirect seen)',
  photo: 'reconciled when the buyer read a guest list from a photo (no bank redirect seen)',
  checkout: 'reconciled when the buyer started another checkout (no bank redirect seen)',
}

const CLIENT_LABEL: Record<ClientInfoKey, string> = {
  timezone: 'Timezone',
  languages: 'Browser languages',
  platform: 'Platform',
  mobile: 'Mobile (browser says)',
  screen: 'Screen',
  viewport: 'Window',
  pixelRatio: 'Pixel ratio',
  touchPoints: 'Touch points',
  cores: 'CPU cores',
  memoryGb: 'Memory (GB, approx.)',
  connection: 'Connection',
  colorScheme: 'Colour scheme',
  standalone: 'Installed as app',
}

const YEREVAN = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Yerevan',
  dateStyle: 'medium',
  timeStyle: 'medium',
})

export const formatYerevan = (date: Date): string => `${YEREVAN.format(date)} (Yerevan)`

export const formatDuration = (ms: number): string => {
  const seconds = Math.max(0, Math.round(ms / 1000))
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ${seconds % 60}s`
  const hours = Math.floor(minutes / 60)
  if (hours < 48) return `${hours}h ${minutes % 60}m`
  return `${Math.floor(hours / 24)}d ${hours % 24}h`
}

const formatAmount = (amount: number, currency: string): string => `${amount.toLocaleString('en-US')} ${currency}`

type Details = Record<string, string>

const paymentDetails = ({ payment }: PaymentFacts, event: PaymentMailEvent, source?: SettleSource): Details => {
  const details: Details = {
    'Order #': String(payment.orderNumber),
    Amount: formatAmount(payment.amount, payment.currency),
    Gateway: payment.gatewayTestMode ? `${payment.gateway} (test mode)` : payment.gateway,
    'Gateway payment id': payment.gatewayPaymentId ?? '— (none)',
    'Payment id': payment.id,
    "Buyer's checkouts": payment.attempt === 1 ? '1st' : `#${payment.attempt}`,
    'Checkout started': formatYerevan(payment.createdAt),
  }
  if (event === 'started') {
    details['Gateway answer'] =
      payment.status === 'failed'
        ? `FAILED — the bank page did not open: ${payment.failureReason ?? 'no reason given'}`
        : 'payment page opened; buyer sent to the bank'
  }
  if (event === 'succeeded' && payment.paidAt) {
    details['Paid at'] = formatYerevan(payment.paidAt)
    details['Time to pay'] = formatDuration(payment.paidAt.getTime() - payment.createdAt.getTime())
    if (source) details['Confirmed'] = SOURCE_LABEL[source]
    if (payment.accessUntil) details['Full access until'] = formatYerevan(payment.accessUntil)
  }
  return details
}

const paidBeforeText = (count: number): string => (count ? `${count} payment(s)` : 'never — first purchase')

const buyerDetails = ({ buyer }: PaymentFacts): Details =>
  buyer.kind === 'guest'
    ? {
        Buyer: 'guest — no account',
        'Guest lists in this browser': String(buyer.guestListCount),
        'Paid before': paidBeforeText(buyer.paidBefore),
      }
    : {
        Buyer: buyer.fullName,
        'Buyer email': buyer.email,
        'Email verified': buyer.emailVerified ? 'yes' : 'no',
        'Signs in with': buyer.signIn,
        'Account id': buyer.id,
        'Account since': formatYerevan(buyer.createdAt),
        'Lists in account': String(buyer.listCount),
        'Paid before': paidBeforeText(buyer.paidBefore),
      }

const listDetails = ({ list }: PaymentFacts): Details => {
  if (!list) return { List: 'none saved — an unsaved draft, or deleted since' }
  const details: Details = {
    'List title': list.title,
    'List id': list.id,
    Template: list.templateId,
    'Print kind': list.kind,
    Guests: String(list.guestCount),
    Tables: String(list.tableCount),
  }
  if (list.heading) details['Heading on the sheet'] = list.heading
  if (list.subheading) details['Line under it'] = list.subheading
  details['List created'] = formatYerevan(list.createdAt)
  details['List last edited'] = formatYerevan(list.updatedAt)
  return details
}

const deviceDetails = (request: RequestInfo): Details => {
  const details: Details = {
    Device: describeUserAgent(request.userAgent),
    IP: request.ip ?? 'unknown',
  }
  if (request.ip) details['IP lookup'] = `https://ipinfo.io/${request.ip}`
  if (request.clientHints) details['Client hints'] = request.clientHints
  if (request.acceptLanguage) details['Accept-Language'] = request.acceptLanguage
  for (const [key, label] of Object.entries(CLIENT_LABEL) as [ClientInfoKey, string][]) {
    const value = request.client[key]
    if (value) details[label] = value
  }
  if (request.referer) details.Referer = request.referer
  details['User agent'] = request.userAgent ?? 'none'
  return details
}

const who = ({ buyer }: PaymentFacts): string =>
  buyer.kind === 'guest' ? 'A guest (no account)' : `${buyer.fullName} <${buyer.email}>`

const listName = ({ list }: PaymentFacts): string => (list ? `the list «${list.title}»` : 'no saved list')

/**
 * One mail per event. `request` is the request that caused it: the click on "pay" for
 * `started`; for `succeeded`, the browser that came back from the bank or read its access.
 */
export const buildPaymentMail = (
  event: PaymentMailEvent,
  facts: PaymentFacts,
  request: RequestInfo | null,
  source?: SettleSource
): InternalMailPayload => {
  const { payment } = facts
  const amount = formatAmount(payment.amount, payment.currency)
  const failed = event === 'started' && payment.status === 'failed'

  const subject =
    event === 'succeeded'
      ? `Payment succeeded · order #${payment.orderNumber} · ${amount}`
      : failed
        ? `Checkout FAILED to start · order #${payment.orderNumber}`
        : `Checkout started · order #${payment.orderNumber} · ${amount}`

  const body =
    event === 'succeeded'
      ? `${who(facts)} paid ${amount} for ${PASS_DAYS} days of full access (started from ${listName(facts)}). Every template and print kind is unlocked, clean, for every list they have${payment.accessUntil ? `, until ${formatYerevan(payment.accessUntil)}` : ''}.`
      : failed
        ? `${who(facts)} clicked "pay" (${amount}, ${PASS_DAYS} days of full access) from ${listName(facts)}, but the gateway refused to open its payment page. Nothing was charged.`
        : `${who(facts)} clicked "pay" (${amount}, ${PASS_DAYS} days of full access) from ${listName(facts)} and was sent to the bank's payment page. A "Payment succeeded" mail with the same order # follows if they pay.`

  const deviceHeading = event === 'started' ? '— Device —' : '— Device (confirming request) —'
  const details: Details = {
    '— Payment —': '',
    ...paymentDetails(facts, event, source),
    '— Buyer —': '',
    ...buyerDetails(facts),
    '— List —': '',
    ...listDetails(facts),
    ...(request ? { [deviceHeading]: '', ...deviceDetails(request) } : {}),
  }

  return {
    subject,
    body,
    firstName: event === 'started' ? 'Checkout' : 'Payment',
    details,
  }
}
