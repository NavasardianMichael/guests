/**
 * What is kept, and for how long (docs/PAYMENTS.md, the privacy policy): nothing is deleted
 * when a pass runs out — lists stay, editable and printable in the free template. Only what has
 * gone **wholly unused for a year** is removed, and "unused" means all three:
 *
 * - not used: an account's session not seen (`User.lastActiveAt`, stamped by
 *   middleware/auth.ts); a guest's list not changed (`GuestList.updatedAt`) — a guest has no
 *   other trace;
 * - not downloaded: no PDF of it (free or under a pass, `PdfDownload`) in that year;
 * - no access running in that year: the owner's pass ended before it began.
 *
 * An account goes with its lists (cascade). Payments and download records stay: they are the
 * accounting record and lose only their link (`SetNull`). Web twin: `RETENTION_DAYS` in
 * `src/constants/pricing.ts`, what the pages promise. The sweep that applies it is
 * services/retentionSweep.ts; this module is import-free, so a unit test can hold it.
 */
export const RETENTION_DAYS = 365

export const DAY_MS = 24 * 60 * 60 * 1000

/** Pure: the moment before which something unused is deleted. */
export const retentionCutoff = (now: Date): Date => new Date(now.getTime() - RETENTION_DAYS * DAY_MS)

export type UsageFacts = {
  /** Last use: an account's last session, a guest list's last change. */
  lastUsedAt: Date
  /** The last download of a PDF of it (of any of the account's lists); null if never. */
  lastDownloadAt: Date | null
  /** When the owner's access pass ends or ended; null if they never had one. */
  accessUntil: Date | null
}

/** Pure: whether everything about it is older than the cutoff — then, and only then, it goes. */
export const isUnusedSince = (facts: UsageFacts, cutoff: Date): boolean => {
  const before = (date: Date | null): boolean => date === null || date.getTime() < cutoff.getTime()
  return before(facts.lastUsedAt) && before(facts.lastDownloadAt) && before(facts.accessUntil)
}
