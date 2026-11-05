import type { ListDesign, Paper } from '@store/lists/single/types'
import { PAPER_SIZES } from '@constants/paper'
import { pageSize } from '@helpers/sheetLayout'

/** The smallest a block can be resized to, mm. Twin: `LIST_LIMITS.minBlockW/H` in the API. */
export const MIN_BLOCK_SIZE = { w: 10, h: 4 } as const

/** Text scale bounds, as the typography slider allows. */
const TEXT_SCALE = { min: 0.4, max: 4 } as const

const clampScale = (scale: number): number => Math.min(TEXT_SCALE.max, Math.max(TEXT_SCALE.min, Math.round(scale * 100) / 100))

/** The text scale a fresh sheet of this paper has: 1 on A4, in proportion on any other. */
export const defaultTextScale = (paper: Paper): number => {
  const { width, height } = pageSize(paper)
  return clampScale(Math.min(width, height) / PAPER_SIZES.A4.width)
}

/**
 * Applies a paper change to `design` in place (a plain object or an immer draft): a named
 * format brings its sizes, a turned custom sheet swaps its sides, a new named size scales the
 * letters with it, and dragged or resized blocks keep their place relative to the sheet.
 */
export const applyPaperPatch = (design: ListDesign, patch: Partial<Paper>): void => {
  const previous = { ...design.paper }
  const before = pageSize(previous)
  const paper = { ...previous, ...patch }
  if (patch.format && patch.format !== 'custom') Object.assign(paper, PAPER_SIZES[patch.format])
  // Turning a custom sheet swaps its sides, the way a named size turns.
  if (paper.format === 'custom' && patch.orientation && patch.orientation !== previous.orientation) {
    Object.assign(paper, { width: paper.height, height: paper.width })
  }
  design.paper = paper
  const after = pageSize(paper)
  // A new named size scales the letters with it: what read well on A4 reads the same on A2.
  // A custom size or a turn leaves them as they are.
  if (patch.format && patch.format !== 'custom' && patch.format !== previous.format) {
    const ratio = Math.min(after.width, after.height) / Math.min(before.width, before.height)
    design.textScale = clampScale(design.textScale * ratio)
  }
  // Dragged and resized blocks keep their place and size relative to the sheet.
  if (after.width !== before.width || after.height !== before.height) {
    const sx = after.width / before.width
    const sy = after.height / before.height
    for (const position of Object.values(design.layout.positions)) {
      position.x = Math.round(position.x * sx * 10) / 10
      position.y = Math.round(position.y * sy * 10) / 10
    }
    for (const size of Object.values(design.layout.sizes)) {
      size.w = Math.max(MIN_BLOCK_SIZE.w, Math.round(size.w * sx * 10) / 10)
      size.h = Math.max(MIN_BLOCK_SIZE.h, Math.round(size.h * sy * 10) / 10)
    }
  }
}
