/**
 * Paper a list prints on. Sizes are portrait millimetres; `orientation` turns them.
 * Twin: `PAPER_FORMATS` / `PAPER_LIMITS` in `server/src/lib/catalogue.ts` (pinned by `twins.spec.ts`).
 */
export const PAPER_FORMATS = ['A5', 'A4', 'A3', 'A2', 'letter', 'custom'] as const

export type PaperFormat = (typeof PAPER_FORMATS)[number]

export type Orientation = 'portrait' | 'landscape'

export const PAPER_SIZES: Record<Exclude<PaperFormat, 'custom'>, { width: number; height: number }> = {
  A5: { width: 148, height: 210 },
  A4: { width: 210, height: 297 },
  A3: { width: 297, height: 420 },
  A2: { width: 420, height: 594 },
  letter: { width: 215.9, height: 279.4 },
}

/** What a custom size and a margin may be, in mm: a business card up to an A0 poster. */
export const PAPER_LIMITS = {
  minSide: 50,
  maxSide: 1189,
  minMargin: 0,
  maxMargin: 60,
} as const

export const isPaperFormat = (value: unknown): value is PaperFormat =>
  typeof value === 'string' && (PAPER_FORMATS as readonly string[]).includes(value)
