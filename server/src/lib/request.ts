import { isIPv4, isIPv6 } from 'node:net'

/**
 * Body-reading helpers shared by the routers.
 *
 * This server carries no schema validator, so every route hand-reads `req.body`.
 * These are the shapes that were being re-derived per route — `asTrimmedString`
 * lived privately in `routes/identity.ts` until `routes/contact.ts` needed it too.
 */

/** `undefined` for anything that is not a non-empty string once trimmed. */
export const asTrimmedString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed.length ? trimmed : undefined
}

/**
 * Trimmed, then capped — for free text going into a column with no length constraint.
 *
 * Truncating rather than rejecting is deliberate for a long body field: a visitor who
 * pasted 40KB into a message box wants the message sent, not a validation error. Reject
 * where the length itself is the signal (an email address), cap where it is not.
 */
export const asBoundedString = (value: unknown, max: number): string | undefined =>
  asTrimmedString(value)?.slice(0, max)

/**
 * The cap on a person's name, mirrored by `MAX_CHARS_FOR_NAME` in `src/constants/form.ts`.
 * Roomier than the 40 each half used to get: the joined legacy names reach 81.
 */
export const MAX_FULL_NAME_LENGTH = 100

/**
 * A person's name as one field — `Provider.fullName`, `Consumer.fullName`,
 * `Appointment.guestFullName`. Runs of whitespace collapse to one space (a pasted tab or
 * double space would otherwise sort and search as a different name), then capped as
 * `asBoundedString` caps. `undefined` when nothing is left; each route words its own 400.
 */
export const asFullName = (value: unknown): string | undefined =>
  typeof value === 'string' ? asBoundedString(value.replace(/\s+/g, ' '), MAX_FULL_NAME_LENGTH)?.trimEnd() : undefined

/** RFC 5321's limit on a full address. Also the backtracking bound for `isEmail`. */
export const MAX_EMAIL_LENGTH = 254

/**
 * Shape check only, deliberately not RFC 5322 — an address is proven by the
 * verification link, and a stricter pattern only rejects real addresses.
 *
 * The length test runs **first** so the regex can never see an unbounded string:
 * `[^\s@]+\.[^\s@]+` is ambiguous (a dot matches `[^\s@]` too), so a long
 * non-matching input would otherwise be a backtracking cost paid per request.
 */
export const isEmail = (value: string): boolean =>
  value.length <= MAX_EMAIL_LENGTH && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)

/** A trimmed, lower-cased address that passes `isEmail`, or null. */
export const asEmail = (value: unknown): string | null => {
  if (typeof value !== 'string') return null
  const email = value.trim().toLowerCase()
  return email.length <= MAX_EMAIL_LENGTH && isEmail(email) ? email : null
}

const expandIpv6 = (ip: string): string[] => {
  const [head = '', tail = ''] = ip.split('::')
  const start = head ? head.split(':') : []
  const end = tail ? tail.split(':') : []
  return [...start, ...Array<string>(Math.max(0, 8 - start.length - end.length)).fill('0'), ...end]
}

/**
 * The address rate limits are keyed on (`trust proxy` is 1, so `req.ip` is the client behind
 * nginx). An IPv6 client is its /64 — one household or phone gets a whole /64 and could
 * otherwise rotate through it without end — and an IPv4-mapped address (`::ffff:1.2.3.4`) is
 * the IPv4 address itself.
 */
export const clientAddress = (req: { ip?: string | undefined }): string => {
  const ip = (req.ip ?? '').split('%')[0] ?? ''
  if (!ip) return 'unknown'
  const mapped = ip.toLowerCase().startsWith('::ffff:') ? ip.slice('::ffff:'.length) : ''
  if (isIPv4(mapped)) return mapped
  if (!isIPv6(ip)) return ip
  const prefix = expandIpv6(ip)
    .slice(0, 4)
    .map((group) => parseInt(group, 16).toString(16))
    .join(':')
  return `${prefix}::/64`
}
