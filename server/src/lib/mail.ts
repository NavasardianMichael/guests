import { config } from '../config.js'

/**
 * The only client for the external mail engine, and the only module that reads
 * `MAIL_API_KEY`.
 *
 * Two endpoints, and the split is a real boundary rather than a naming choice:
 *
 * | | Reaches | `to` | Used by |
 * |---|---|---|---|
 * | `/mail/internal/send` | **us** — the admin inbox | engine-owned, never sent | contact form, admin alerts |
 * | `/mail/external/send` | **a user** | required | email verification, booking mail |
 *
 * So an internal send cannot be aimed anywhere, and an external send must name an
 * address the caller already holds. Never reach for `internal` to mail a user, or
 * `external` to mail ourselves. Replies to an external send reach the engine's owner,
 * not us — so no mail may ask its reader to reply.
 *
 * **The key never leaves this module.** It is not returned, not put in an error, and
 * not logged — a failed send logs the status and the engine's own message, never the
 * request headers. The frontend must never call the engine directly; it has no key and
 * adding one would ship it to the browser.
 */

/** The engine rejects a request body that omits this; injected here so no caller can forget. */
const APP_ID = 'Guests'

/**
 * Every external send goes out as `Իմ հյուրերը <guests@…>` — the engine owns the
 * domain; only the part before `@` is ours. Mailbox providers build reputation per sender,
 * so these stay fixed: one sender for every kind of mail, never varied per call site.
 * The engine accepts letters, digits and single `.` `_` `-` between them, max 64 chars —
 * anything else answers `400` on every send.
 */
const EXTERNAL_SENDER = { fromName: 'Իմ հյուրերը', mailFromPrefix: 'guests' } as const

const MAIL_TIMEOUT_MS = 10_000

/**
 * Contact-form shape. Every field but `appId` is optional — the engine substitutes its
 * own defaults ('Contact Form Submission', 'No message provided', 'Anonymous').
 */
export type InternalMailPayload = {
  subject?: string
  body?: string
  senderEmail?: string
  /**
   * The engine's own field names. This app keeps one `fullName` per person and sends it
   * here whole; `lastName` is left for other callers of the engine.
   */
  firstName?: string
  lastName?: string
  phoneNumber?: string
  /** Free-form context rendered alongside the message. Keep it small and non-sensitive. */
  details?: Record<string, unknown>
  /**
   * Honeypot. A human leaves it empty; a bot fills it in. Forwarded so the engine can
   * score it, but callers should drop the submission themselves — see `routes/contact.ts`.
   */
  website?: string
}

/**
 * No `replyTo`: the engine sends every reply to its owner's inbox and ignores the field.
 * A reader who needs to reach someone gets a link in the body instead.
 */
export type ExternalMailPayload = {
  to: string
  subject: string
  /** One of `text` / `html` is required. Send both so text-only clients render.  */
  text?: string
  html?: string
}

export type MailResult =
  | { ok: true; messageId?: string }
  /** `status: 0` means the request never left — not configured, timed out, or DNS. */
  | { ok: false; status: number; message: string }

/** Engine success body: `{ success, message, messageId }`. */
type MailEngineResponse = {
  success?: boolean
  message?: string
  messageId?: string
  errors?: { field?: string; message?: string }[]
}

/**
 * False in local dev, where `.env.example` ships an empty key on purpose. Callers use
 * this to decide between "log the link" and "fail the request" — a verification email
 * that silently never sends is worse than a visible error.
 */
export const isMailConfigured = (): boolean => Boolean(config.mail.apiUrl && config.mail.apiKey)

/** Joined by hand rather than `new URL(path, base)`, which would discard a base path. */
const mailUrl = (path: string): string => `${config.mail.apiUrl}${path}`

const describeFailure = (status: number, parsed: MailEngineResponse | null): string => {
  const fields = parsed?.errors?.map((e) => [e.field, e.message].filter(Boolean).join(': ')).filter(Boolean)
  const detail = fields?.length ? ` (${fields.join('; ')})` : ''
  return `${parsed?.message ?? `Mail engine responded ${status}`}${detail}`
}

const send = async (path: string, payload: object): Promise<MailResult> => {
  if (!isMailConfigured()) {
    return { ok: false, status: 0, message: 'Mail engine is not configured' }
  }

  let response: Response
  try {
    response = await fetch(mailUrl(path), {
      method: 'POST',
      headers: {
        // JSON is UTF-8 by spec; said explicitly so no engine guesses otherwise for Armenian text.
        'Content-Type': 'application/json; charset=utf-8',
        'x-api-key': config.mail.apiKey,
      },
      body: JSON.stringify({ appId: APP_ID, ...payload }),
      signal: AbortSignal.timeout(MAIL_TIMEOUT_MS),
    })
  } catch (err) {
    // Network, DNS or the 10s timeout. The engine's own errors arrive as a response.
    const message = err instanceof Error ? err.message : 'Mail request failed'
    console.error(`[mail] ${path} did not complete: ${message}`)
    return { ok: false, status: 0, message }
  }

  const parsed = (await response.json().catch(() => null)) as MailEngineResponse | null

  if (!response.ok || parsed?.success === false) {
    const message = describeFailure(response.status, parsed)
    // Status and the engine's message only — never the headers, which carry the key.
    console.error(`[mail] ${path} failed: ${response.status} ${message}`)
    return { ok: false, status: response.status, message }
  }

  return { ok: true, messageId: parsed?.messageId }
}

/** Notify the admin inbox. The engine owns the recipient, so there is nothing to aim. */
export const sendInternalMail = (payload: InternalMailPayload): Promise<MailResult> =>
  send('/mail/internal/send', payload)

/** Mail a user at an address they already hold. */
export const sendExternalMail = (payload: ExternalMailPayload): Promise<MailResult> =>
  send('/mail/external/send', { ...EXTERNAL_SENDER, ...payload })

/**
 * Mail about the reader's own account (verification, password links and notices).
 * Unconfigured is normal in dev, where the mail prints here instead, links included, and an
 * outage in production, where the caller must not pretend it went.
 */
export const sendAccountMail = async (label: string, payload: ExternalMailPayload): Promise<MailResult> => {
  if (!isMailConfigured()) {
    if (config.nodeEnv === 'production') {
      console.error(`[mail] ${label} not sent: MAIL_API_URL or MAIL_API_KEY is empty`)
      return { ok: false, status: 0, message: 'Mail engine is not configured' }
    }
    console.log(`[mail] ${label} for ${payload.to}
${payload.text ?? ''}`)
    return { ok: true }
  }
  return sendExternalMail(payload)
}

/**
 * The engine sanitises HTML with DOMPurify, which strips scripts and handlers but does
 * **not** make visitor-authored text safe to interpolate into our own markup — an
 * `<a href>` or `<img>` a visitor typed would survive as live markup and render as ours.
 *
 * So every value that came from a request body goes through this before it reaches an
 * HTML template. Prefer the plain-text field where a template is not needed at all.
 */
export const escapeHtml = (value: string): string =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
