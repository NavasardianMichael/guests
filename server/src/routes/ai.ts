import express, { Router } from 'express'
import { isAiConfigured } from '../config.js'
import { fail, ok } from '../lib/api-response.js'
import { ERROR_CODE } from '../lib/error-codes.js'
import { createRateLimiter } from '../lib/rateLimit.js'
import { asyncHandler } from '../middleware/error.js'
import { readGuestList, UnreadableImageError } from '../services/guestReader.js'

/**
 * Photo import: a picture of a guest list in, names and tables out (`services/guestReader.ts`).
 * Open to guests too — nobody needs an account to start a list — so it is limited per IP, and
 * more tightly than for an account: each call costs a model request.
 */
export const aiRouter = Router()

/** The web downsizes photos to 2000px JPEG (~0.5–1.5MB, a third more as base64). */
const MAX_IMAGE_BASE64 = 8 * 1024 * 1024
const DATA_URL = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/

const guestLimiter = createRateLimiter({ limit: 15, windowMs: 60 * 60 * 1000 })
const accountLimiter = createRateLimiter({ limit: 60, windowMs: 60 * 60 * 1000 })

aiRouter.post(
  '/extract-guests',
  // Larger than the app-wide JSON limit: this one body is a photo.
  express.json({ limit: '9mb' }),
  asyncHandler(async (req, res) => {
    if (!isAiConfigured()) return fail(res, 'Photo import is not configured', ERROR_CODE.aiUnavailable, 503)

    const verdict = req.session ? accountLimiter(req.session.userId) : guestLimiter(req.ip ?? 'unknown')
    if (!verdict.allowed) {
      res.setHeader('Retry-After', String(verdict.retryAfterSeconds))
      return fail(res, 'Too many photos', ERROR_CODE.rateLimited, 429)
    }

    const image: unknown = req.body?.image
    const match = typeof image === 'string' && image.length <= MAX_IMAGE_BASE64 ? DATA_URL.exec(image) : null
    if (!match) return fail(res, 'Expected a JPEG, PNG or WebP data URL', ERROR_CODE.imageInvalid, 400)

    try {
      const guests = await readGuestList({ mimeType: match[1], base64: match[2] })
      ok(res, { guests })
    } catch (error) {
      if (error instanceof UnreadableImageError) return ok(res, { guests: [] })
      console.error('[ai] reading a guest list failed', error)
      return fail(res, 'The photo could not be read', ERROR_CODE.aiFailed, 502)
    }
  })
)
