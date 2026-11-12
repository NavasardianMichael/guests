import express, { type Request, Router } from 'express'
import { isAiConfigured } from '../config.js'
import { fail, ok } from '../lib/api-response.js'
import { ERROR_CODE } from '../lib/error-codes.js'
import { readGuestKeyHash } from '../lib/guest.js'
import { createRateLimiter } from '../lib/rateLimit.js'
import { readRequestInfo } from '../lib/request-info.js'
import type { ListOwner } from '../middleware/auth.js'
import { asyncHandler } from '../middleware/error.js'
import { readGuestList, UnreadableImageError } from '../services/guestReader.js'
import { runningPass, shownPass } from '../services/payments.js'
import { type PhotoStatus, photoStatus } from '../services/photoQuota.js'
import { claimPhotoRead, photoReadsSince, releasePhotoRead } from '../services/photoReads.js'

/**
 * Photo import: a picture of a guest list in, names and tables out (`services/guestReader.ts`).
 * It comes with full access — a running pass, the account's or this browser's guest key's —
 * and each pass brings `PHOTO_READS_PER_PASS` reads, one photo per request
 * (`services/photoQuota.ts`): each read costs a model request. Only a photo that yields names
 * counts: one the model could not read, or our own failure, gives the read back. The web
 * disables the upload and says why (`GET /ai/photo`); this route enforces the same, whatever
 * the client sends.
 */
export const aiRouter = Router()

/** The web downsizes photos to 2000px JPEG (~0.5–1.5MB, a third more as base64). */
const MAX_IMAGE_BASE64 = 8 * 1024 * 1024
const DATA_URL = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/

// Before the pass check, which asks the bank: bounds what a script can make it do.
const guestLimiter = createRateLimiter({ limit: 15, windowMs: 60 * 60 * 1000 })
const accountLimiter = createRateLimiter({ limit: 60, windowMs: 60 * 60 * 1000 })

/** Whose photo it is: the account, else this browser's guest key, else nobody's (no pass either). */
const photoOwnerOf = (req: Request): ListOwner | null => {
  if (req.session) return { userId: req.session.userId }
  const guestKeyHash = readGuestKeyHash(req)
  return guestKeyHash ? { guestKeyHash } : null
}

const toJson = (status: PhotoStatus) => ({
  state: status.state,
  allowance: status.allowance,
  remaining: status.remaining,
  until: status.until?.toISOString() ?? null,
})

/**
 * Whether this visitor may read a photo: `{ state, allowance, remaining, until }` (`PhotoStatus`;
 * `until` ISO, when the running access ends). Reading it settles a payment whose redirect was lost.
 */
aiRouter.get(
  '/photo',
  asyncHandler(async (req, res) => {
    const owner = photoOwnerOf(req)
    const window = owner ? await shownPass(owner, { source: 'access', request: readRequestInfo(req) }) : null
    const reads = owner && window ? await photoReadsSince(owner, window.startedAt) : 0
    ok(res, toJson(photoStatus(window, reads)))
  })
)

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

    const owner = photoOwnerOf(req)
    const pass = owner ? await runningPass(owner, { source: 'photo', request: readRequestInfo(req) }) : null
    if (!owner || !pass) return fail(res, 'Photo import needs full access', ERROR_CODE.photoNeedsAccess, 402)

    const claimed = await claimPhotoRead(owner, pass)
    if (!claimed) return fail(res, 'Every photo read of this access is used', ERROR_CODE.photoLimitReached, 429)
    // What is left once this read counts, or as it was when it gives the read back.
    const statusAfter = async () => toJson(photoStatus(pass, await photoReadsSince(owner, pass.startedAt)))

    try {
      const guests = await readGuestList({ mimeType: match[1], base64: match[2] })
      // Nothing read gave the buyer nothing: they keep the read for a clearer photo.
      if (!guests.length) await releasePhotoRead(claimed)
      ok(res, { guests, photo: await statusAfter() })
    } catch (error) {
      // Not a list, an unreadable answer, or the model unreachable: the buyer keeps the read.
      await releasePhotoRead(claimed)
      if (error instanceof UnreadableImageError) return ok(res, { guests: [], photo: await statusAfter() })
      console.error('[ai] reading a guest list failed', error)
      return fail(res, 'The photo could not be read', ERROR_CODE.aiFailed, 502)
    }
  })
)
