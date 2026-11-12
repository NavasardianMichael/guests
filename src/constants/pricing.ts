/**
 * The business model (docs/PAYMENTS.md): building, previewing and printing in the free template
 * (with the "made with" line) cost nothing; an **access pass** opens everything — every
 * template and kind, clean pages, unlimited downloads — for `PASS_DAYS`. A pass bought while
 * one runs adds its days on top. When it runs out nothing is deleted; what has gone unused for
 * `RETENTION_DAYS` is (server/src/services/retention.ts).
 *
 * The server's twins (`server/src/services/pricing.ts`, `services/retention.ts`) are the ones
 * charged and enforced; `twins.spec.ts` pins them equal.
 */
export const PASS_PRICE_AMD = 2000

export const PASS_DAYS = 21

/** Photo reads (a guest list read from a photo by AI) each pass brings. Twin: `server/src/services/photoQuota.ts`. */
export const PHOTO_READS_PER_PASS = 5

export const RETENTION_DAYS = 365

export const CURRENCY = 'AMD'

/** "2,000 դրամ" — grouped the way Armenian sites print prices; the unit is translated by the caller. */
export const formatAmount = (amount: number): string => amount.toLocaleString('en-US')

const DAY_MS = 24 * 60 * 60 * 1000

/** Whether access ending at `until` (epoch ms, null: never bought) is still running at `now`. */
export const isAccessActive = (until: number | null, now: number): boolean => until !== null && until > now

/** Whole days left, counting a started day (2.1 days left is 3); 0 once it has run out. */
export const accessDaysLeft = (until: number | null, now: number): number =>
  until === null || until <= now ? 0 : Math.ceil((until - now) / DAY_MS)

/** When access would end if a pass were bought at `now`: on top of a running one, else from now. */
export const accessAfterPurchase = (until: number | null, now: number): number =>
  Math.max(until ?? 0, now) + PASS_DAYS * DAY_MS
