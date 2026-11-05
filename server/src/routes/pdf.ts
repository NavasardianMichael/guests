import { Router } from 'express'
import { fail } from '../lib/api-response.js'
import { ERROR_CODE } from '../lib/error-codes.js'
import { sendPdf } from '../lib/pdf-response.js'
import { createRateLimiter } from '../lib/rateLimit.js'
import { asyncHandler } from '../middleware/error.js'
import { printTerms } from '../services/entitlement.js'
import { coerceContent, coerceDesign, coerceTitle, DEFAULT_LIST_TITLE } from '../services/listDocument.js'

/** The "made with" line a free print carries once billing is on. */
export const WATERMARK_TEXT = 'guests.eapps.site'

/**
 * The PDF of a document the server does not hold: a guest's local draft. No account and no
 * storage — the body is coerced like any list write, printed, and forgotten. Public, so it is
 * limited per IP; the print queue's own cap (`MAX_WAITING` in services/pdf.ts) bounds what
 * many IPs together can stack up.
 */
export const pdfRouter = Router()

const draftPdfLimiter = createRateLimiter({ limit: 20, windowMs: 10 * 60 * 1000 })

pdfRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const verdict = draftPdfLimiter(req.ip ?? 'unknown')
    if (!verdict.allowed) {
      res.setHeader('Retry-After', String(verdict.retryAfterSeconds))
      return fail(res, 'Too many prints', ERROR_CODE.rateLimited, 429)
    }
    const design = coerceDesign(req.body?.design)
    // A draft is never paid for: with billing on, only the free templates print.
    const terms = printTerms({ templateId: design.templateId, paidAt: null })
    if (!terms.allowed) return fail(res, 'Payment required', ERROR_CODE.listNotPaid, 402)
    await sendPdf(res, 'a guest draft', {
      title: coerceTitle(req.body?.title, DEFAULT_LIST_TITLE),
      content: coerceContent(req.body?.content),
      design,
      watermark: terms.watermark,
      watermarkText: WATERMARK_TEXT,
    })
  })
)
