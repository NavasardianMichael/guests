import { Prisma } from '@prisma/client'
import { type Request, Router } from 'express'
import { WATERMARK_TEXT } from './pdf.js'
import { fail, ok } from '../lib/api-response.js'
import { ERROR_CODE } from '../lib/error-codes.js'
import { ensureGuestKeyHash } from '../lib/guest.js'
import { sendPdf } from '../lib/pdf-response.js'
import { prisma } from '../lib/prisma.js'
import { createRateLimiter } from '../lib/rateLimit.js'
import { readRequestInfo } from '../lib/request-info.js'
import { mapList } from '../mappers/entities.js'
import { type ListOwner, listOwnerOf, ownerKey, requireListOwner } from '../middleware/auth.js'
import { asyncHandler, HttpError } from '../middleware/error.js'
import { recordDownload } from '../services/downloads.js'
import { coerceContent, coerceDesign, coerceTitle, DEFAULT_LIST_TITLE } from '../services/listDocument.js'
import { printTermsFor } from '../services/payments.js'

/**
 * A user's guest lists — or a guest's: lists a browser keeps on the server without an
 * account, owned by its guest key (`lib/guest.ts`). Every route is scoped to that owner
 * (`requireListOwner`): an id that is not theirs answers 404, the same as one that does not
 * exist. (A guest normally works in a local draft; a guest's server lists come from
 * duplicates and earlier imports. What a guest buys — a template — belongs to the same key:
 * `docs/PAYMENTS.md`.)
 */
export const listsRouter = Router()

const MAX_LISTS_PER_USER = 100
const MAX_LISTS_PER_GUEST = 10

const guestCreateLimiter = createRateLimiter({ limit: 10, windowMs: 60 * 60 * 1000 })
const pdfLimiter = createRateLimiter({ limit: 40, windowMs: 10 * 60 * 1000 })

const maxLists = (owner: ListOwner): number => ('userId' in owner ? MAX_LISTS_PER_USER : MAX_LISTS_PER_GUEST)

const loadOwnedList = async (req: Request) => {
  const list = await prisma.guestList.findFirst({ where: { id: String(req.params.id), ...listOwnerOf(req) } })
  if (!list) throw new HttpError(404, 'Not found', 404)
  return list
}

const asJson = (value: unknown): Prisma.InputJsonValue => value as Prisma.InputJsonValue

/** Columns kept beside the JSON for listing without parsing it. */
const denormalised = (content: ReturnType<typeof coerceContent>, design: ReturnType<typeof coerceDesign>) => ({
  templateId: design.templateId,
  kind: design.kind,
  guestCount: content.guests.length,
})

/**
 * Also how a guest's local draft is imported after sign-in: it arrives as the body. Without a
 * session the request mints the browser's guest key, which then owns the list. Registered
 * before `requireListOwner`, which would refuse that guest.
 */
listsRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    let owner: ListOwner
    if (req.session) owner = { userId: req.session.userId }
    else {
      const verdict = guestCreateLimiter(req.ip ?? 'unknown')
      if (!verdict.allowed) return fail(res, 'Too many attempts', ERROR_CODE.rateLimited, 429)
      owner = { guestKeyHash: ensureGuestKeyHash(req, res) }
    }
    const count = await prisma.guestList.count({ where: owner })
    if (count >= maxLists(owner)) return fail(res, 'List limit reached', ERROR_CODE.listLimitReached, 409)

    const content = coerceContent(req.body?.content)
    const design = coerceDesign(req.body?.design)
    const list = await prisma.guestList.create({
      data: {
        ...owner,
        title: coerceTitle(req.body?.title, DEFAULT_LIST_TITLE),
        ...denormalised(content, design),
        content: asJson(content),
        design: asJson(design),
      },
    })
    ok(res, mapList(list), 201)
  })
)

listsRouter.use(requireListOwner)

listsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const lists = await prisma.guestList.findMany({ where: listOwnerOf(req), orderBy: { updatedAt: 'desc' } })
    ok(res, lists.map(mapList))
  })
)

listsRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    ok(res, mapList(await loadOwnedList(req)))
  })
)

/** The autosave. Partial: only the fields sent are written. Answers the stamps, not the body. */
listsRouter.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const list = await loadOwnedList(req)
    const data: Prisma.GuestListUpdateInput = {}
    if (req.body?.title !== undefined) data.title = coerceTitle(req.body.title, list.title)
    const content = req.body?.content !== undefined ? coerceContent(req.body.content) : coerceContent(list.content)
    const design = req.body?.design !== undefined ? coerceDesign(req.body.design) : coerceDesign(list.design)
    if (req.body?.content !== undefined) data.content = asJson(content)
    if (req.body?.design !== undefined) data.design = asJson(design)
    Object.assign(data, denormalised(content, design))
    const updated = await prisma.guestList.update({ where: { id: list.id }, data })
    ok(res, { updatedAt: updated.updatedAt.toISOString() })
  })
)

/** A copy is a new list, in the same template: printable on the same terms (a bought template is the owner's). */
listsRouter.post(
  '/:id/duplicate',
  asyncHandler(async (req, res) => {
    const source = await loadOwnedList(req)
    const owner = listOwnerOf(req)
    if ((await prisma.guestList.count({ where: owner })) >= maxLists(owner)) {
      return fail(res, 'List limit reached', ERROR_CODE.listLimitReached, 409)
    }
    const copy = await prisma.guestList.create({
      data: {
        ...owner,
        title: coerceTitle(`${source.title} (2)`, DEFAULT_LIST_TITLE),
        templateId: source.templateId,
        kind: source.kind,
        guestCount: source.guestCount,
        content: asJson(source.content),
        design: asJson(source.design),
      },
    })
    ok(res, mapList(copy), 201)
  })
)

listsRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const list = await loadOwnedList(req)
    await prisma.guestList.delete({ where: { id: list.id } })
    ok(res, null)
  })
)

/**
 * The PDF, as designed — on the terms `services/entitlement.ts` sets (every template, clean,
 * while its owner's pass runs, asked again so a refund takes it back; the free template with
 * the "made with" line otherwise). Every one sent in full is recorded (`PdfDownload`): against
 * its payment when under a pass, and either way as a use that keeps the list from the
 * retention sweep.
 */
listsRouter.get(
  '/:id/pdf',
  asyncHandler(async (req, res) => {
    const list = await loadOwnedList(req)
    const owner = listOwnerOf(req)
    if (!pdfLimiter(ownerKey(owner)).allowed) return fail(res, 'Too many prints', ERROR_CODE.rateLimited, 429)
    const design = coerceDesign(list.design)
    const terms = await printTermsFor(owner, design.templateId, readRequestInfo(req))
    if (!terms.allowed) return fail(res, 'Payment required', ERROR_CODE.listNotPaid, 402)
    await sendPdf(
      res,
      list.id,
      { title: list.title, content: coerceContent(list.content), design, watermark: terms.watermark, watermarkText: WATERMARK_TEXT },
      recordDownload(req, { listId: list.id, templateId: design.templateId, paymentId: terms.paymentId })
    )
  })
)
