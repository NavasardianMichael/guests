import { DAY_MS, RETENTION_DAYS, retentionCutoff } from './retention.js'
import { prisma } from '../lib/prisma.js'

/**
 * Applies the retention policy (services/retention.ts): deletes accounts unused for
 * `RETENTION_DAYS`, with their lists, and guests' lists unchanged for as long.
 */
export const purgeUnused = async (now = new Date()): Promise<{ users: number; guestLists: number }> => {
  const cutoff = retentionCutoff(now)
  const users = await prisma.user.deleteMany({ where: { lastActiveAt: { lt: cutoff } } })
  const guestLists = await prisma.guestList.deleteMany({ where: { userId: null, updatedAt: { lt: cutoff } } })
  return { users: users.count, guestLists: guestLists.count }
}

const SWEEP_EVERY_MS = DAY_MS
/** Not at boot: a deploy restarting the API should not also be the moment it deletes. */
const FIRST_SWEEP_MS = 10 * 60 * 1000

const sweep = async (): Promise<void> => {
  try {
    const removed = await purgeUnused()
    if (removed.users || removed.guestLists) {
      console.info(`[retention] removed ${removed.users} account(s) and ${removed.guestLists} guest list(s) unused for ${RETENTION_DAYS} days`)
    }
  } catch (error) {
    console.error('[retention] sweep failed', error instanceof Error ? error.message : error)
  }
}

/** Runs the sweep once a day in the API process. Idempotent, so several instances may each run it. */
export const scheduleRetention = (): void => {
  setTimeout(() => {
    void sweep()
    setInterval(() => void sweep(), SWEEP_EVERY_MS).unref()
  }, FIRST_SWEEP_MS).unref()
}
