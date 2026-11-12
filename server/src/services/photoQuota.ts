/**
 * Who may read a guest list from a photo (docs/PAYMENTS.md): it comes with full access — a
 * running pass — and each pass brings `PHOTO_READS_PER_PASS` reads, one photo per request. Each
 * read costs a model request. The reads are counted over the running access window: from when
 * it began (its first pass's `paidAt`), against `PHOTO_READS_PER_PASS` × the passes it is made
 * of — so days bought on top of a running pass bring their reads too, and a new pass after one
 * ran out starts a fresh count. The rows behind it are `PhotoRead` (services/photoReads.ts).
 * Web twin: `PHOTO_READS_PER_PASS` in `src/constants/pricing.ts`. Import-free, so a unit test
 * can hold it.
 */

export const PHOTO_READS_PER_PASS = 5

/** The running access window: when it began, when it ends, how many passes it is made of. */
export type PassWindow = { startedAt: Date; until: Date; passes: number }

/**
 * `locked`: no running pass — photo reading needs full access. `used`: every read of the running
 * window is spent (more days bring more). `available`: `remaining` reads are left.
 */
export type PhotoState = 'locked' | 'available' | 'used'

export type PhotoStatus = { state: PhotoState; allowance: number; remaining: number; until: Date | null }

/** Pure: the state, given the running window (null: none runs) and the reads made since it began. */
export const photoStatus = (window: PassWindow | null, readsSinceStart: number): PhotoStatus => {
  if (!window) return { state: 'locked', allowance: 0, remaining: 0, until: null }
  const allowance = PHOTO_READS_PER_PASS * window.passes
  const remaining = Math.max(0, allowance - readsSinceStart)
  return { state: remaining > 0 ? 'available' : 'used', allowance, remaining, until: window.until }
}
