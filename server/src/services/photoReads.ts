import { type PassWindow, PHOTO_READS_PER_PASS } from './photoQuota.js'
import { RETENTION_DAYS } from './retention.js'
import { prisma } from '../lib/prisma.js'
import type { ListOwner } from '../middleware/auth.js'

/**
 * The `PhotoRead` rows behind the photo limit (services/photoQuota.ts). A read is claimed
 * **before** the model is asked, so two requests racing each other cannot both take the last
 * one, and released again when the read gave the buyer nothing (no names, or our failure).
 */

/** Reads this owner made since the running window began. */
export const photoReadsSince = async (owner: ListOwner, startedAt: Date): Promise<number> =>
  prisma.photoRead.count({ where: { ...owner, createdAt: { gte: startedAt } } })

/**
 * Takes one of this window's reads: writes the row, then checks the window's count is still
 * within its allowance. Two racing claims for the last read may both see too many and both give
 * up — the buyer simply tries again — but never both proceed. Returns the row's id, or null when
 * every read is spent.
 */
export const claimPhotoRead = async (owner: ListOwner, window: PassWindow): Promise<string | null> => {
  const row = await prisma.photoRead.create({ data: { ...owner }, select: { id: true } })
  if ((await photoReadsSince(owner, window.startedAt)) > PHOTO_READS_PER_PASS * window.passes) {
    await prisma.photoRead.delete({ where: { id: row.id } })
    return null
  }
  return row.id
}

/** Gives the read back: it gave the buyer nothing. */
export const releasePhotoRead = async (id: string): Promise<void> => {
  await prisma.photoRead.deleteMany({ where: { id } })
}

/** Reads from long before any window that could still be running matter to nobody. */
export const purgeOldPhotoReads = async (now = new Date()): Promise<number> => {
  const removed = await prisma.photoRead.deleteMany({
    where: { createdAt: { lt: new Date(now.getTime() - RETENTION_DAYS * 24 * 60 * 60 * 1000) } },
  })
  return removed.count
}
