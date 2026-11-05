import { Router } from 'express'
import { config } from '../config.js'
import { fail, ok } from '../lib/api-response.js'
import { ERROR_CODE } from '../lib/error-codes.js'
import { isMailConfigured, sendInternalMail } from '../lib/mail.js'
import { createRateLimiter } from '../lib/rateLimit.js'
import { asBoundedString, asEmail, asFullName, asTrimmedString } from '../lib/request.js'
import { asyncHandler } from '../middleware/error.js'

/**
 * The contact form. A message goes to the admin inbox through the mail engine's internal
 * endpoint, so a visitor can reach us but can never aim mail anywhere else.
 */
export const contactRouter = Router()

/** Twin of the web form's `maxLength` (`components/contact/ContactForm.tsx`). */
export const MAX_CONTACT_MESSAGE_LENGTH = 5000

const SUBJECT = 'Guests / Contact'

/**
 * Per IP, and tight: the mail engine allows 10 sends a minute for this whole server, which
 * password-reset mail shares (`lib/rateLimit.ts`).
 */
const contactLimiter = createRateLimiter({ limit: 5, windowMs: 60 * 60 * 1000 })

contactRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const verdict = contactLimiter(req.ip ?? 'unknown')
    if (!verdict.allowed) {
      res.setHeader('Retry-After', String(verdict.retryAfterSeconds))
      return fail(res, 'Too many messages', ERROR_CODE.rateLimited, 429)
    }

    // Honeypot: the form hides `website` from people, so only a bot fills it. It is told the
    // message went, and nothing is sent.
    if (asTrimmedString(req.body?.website)) return ok(res, null)

    const fullName = asFullName(req.body?.fullName)
    const email = asEmail(req.body?.email)
    const message = asBoundedString(req.body?.message, MAX_CONTACT_MESSAGE_LENGTH)
    if (!fullName || !email || !message) return fail(res, 'Name, a valid email and a message are required', 400, 400)

    // Unconfigured is normal in dev (the message prints here) and an outage in production.
    if (!isMailConfigured()) {
      if (config.nodeEnv === 'production')
        return fail(res, 'Mail engine is not configured', ERROR_CODE.contactFailed, 503)
      console.log(`[contact] ${fullName} <${email}>\n${message}`)
      return ok(res, null)
    }

    const result = await sendInternalMail({
      subject: SUBJECT,
      body: message,
      senderEmail: email,
      firstName: fullName,
      // Signed in: which account wrote, which may differ from the address they typed.
      ...(req.session ? { details: { accountId: req.session.userId } } : {}),
    })
    if (!result.ok) return fail(res, 'Message could not be sent', ERROR_CODE.contactFailed, 502)
    ok(res, null)
  })
)
