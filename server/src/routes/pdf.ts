import { type Request, Router } from 'express'
import { fail } from '../lib/api-response.js'
import { ERROR_CODE } from '../lib/error-codes.js'
import { readGuestKeyHash } from '../lib/guest.js'
import { sendPdf } from '../lib/pdf-response.js'
import { createRateLimiter } from '../lib/rateLimit.js'
import type { ListOwner } from '../middleware/auth.js'
import { asyncHandler } from '../middleware/error.js'
import { recordDownload } from '../services/downloads.js'
import { coerceContent, coerceDesign, coerceTitle, DEFAULT_LIST_TITLE } from '../services/listDocument.js'
import { printTermsFor } from '../services/payments.js'

/**
 * The "made with" line every download not paid for carries (`services/entitlement.ts`), worded
 * as cv-builder's; it links to the site. Twin of the web's `WATERMARK_TEXT` (`constants/app.ts`).
 */
export const WATERMARK_TEXT = 'Ստեղծված guests-seating-board.eapps.site-ում'

/**
 * The PDF of a document the server does not hold: a guest's local draft. No account and no
 * storage — the body is coerced like any list write, printed, and forgotten. Public, so it is
 * limited per IP; the print queue's own cap (`MAX_WAITING` in services/pdf.ts) bounds what
 * many IPs together can stack up. A template this browser (or account) has bought prints
 * clean here too: the licence is the owner's, not a list's.
 */
export const pdfRouter = Router()

const draftPdfLimiter = createRateLimiter({ limit: 20, windowMs: 10 * 60 * 1000 })

/** Whose templates a draft may print in: the account, else this browser's guest key, else nobody's. */
const draftOwnerOf = (req: Request): ListOwner | null => {
  if (req.session) return { userId: req.session.userId }
  const guestKeyHash = readGuestKeyHash(req)
  return guestKeyHash ? { guestKeyHash } : null
}

pdfRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const verdict = draftPdfLimiter(req.ip ?? 'unknown')
    if (!verdict.allowed) {
      res.setHeader('Retry-After', String(verdict.retryAfterSeconds))
      return fail(res, 'Too many prints', ERROR_CODE.rateLimited, 429)
    }
    const design = coerceDesign(req.body?.design)
    const terms = await printTermsFor(draftOwnerOf(req), design.templateId)
    if (!terms.allowed) return fail(res, 'Payment required', ERROR_CODE.listNotPaid, 402)
    await sendPdf(
      res,
      'a guest draft',
      {
        title: coerceTitle(req.body?.title, DEFAULT_LIST_TITLE),
        content: coerceContent(req.body?.content),
        design,
        watermark: terms.watermark,
        watermarkText: WATERMARK_TEXT,
      },
      terms.paymentId ? recordDownload(req, { listId: null, templateId: design.templateId, paymentId: terms.paymentId }) : undefined
    )
  })
)
