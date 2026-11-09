/**
 * What is kept, and for how long (docs/PAYMENTS.md, the privacy policy): nothing is deleted
 * when a pass runs out — lists stay, editable and printable in the free template. Only what has
 * gone **unused for a year** is removed:
 *
 * - an account whose session has not been used for `RETENTION_DAYS` (`User.lastActiveAt`,
 *   stamped by middleware/auth.ts), with its lists (cascade);
 * - a guest's list (owned by a browser's guest key) not changed for `RETENTION_DAYS` — a
 *   guest has no other trace to go by.
 *
 * Payments and download records stay: they are the accounting record and lose only their link
 * (`SetNull`). Web twin: `RETENTION_DAYS` in `src/constants/pricing.ts`, what the pages promise.
 * The sweep that applies it is services/retentionSweep.ts; this module is import-free, so a unit
 * test can hold it.
 */
export const RETENTION_DAYS = 365

export const DAY_MS = 24 * 60 * 60 * 1000

/** Pure: the moment before which something unused is deleted. */
export const retentionCutoff = (now: Date): Date => new Date(now.getTime() - RETENTION_DAYS * DAY_MS)
