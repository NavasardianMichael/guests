import type { ListDocument } from '@store/lists/single/types'
import { layoutSheet, LIST_TABLE_GAP, type Measure, type SheetLayout } from '@helpers/sheetLayout'

/** Text scale bounds, as the typography slider allows (and the API keeps). */
export const FIT_SCALE = { min: 0.4, max: 4 } as const

/** The most grid columns a sheet may have (the layout and the API cap it there too). */
const MAX_COLUMNS = 12
/** A plain list's names stay readable: no more columns than this. */
const MAX_LIST_COLUMNS = 6
/** Halvings of the scale range: 3.6 / 2^10 ≈ 0.004, finer than the 0.01 kept. */
const STEPS = 10

/** A sheet fitted to its paper: how many grid columns, how big the text, and on how many pages. */
export type Fit = { columns: number; textScale: number; pages: number; rows: number }

/**
 * The names a sheet breaks onto a second line: guests (by guest id) and table names (by table
 * id). A fitted sheet keeps them whole — bigger letters are no gain when "Petrosyan" lands
 * under "Aram", or a long word is cut between letters to fit a narrow column.
 */
const wrappedNames = (sheet: SheetLayout): string[] =>
  sheet.blocks.flatMap((block) => {
    if (block.type === 'guest') return block.lines.length > 1 ? [block.guest.id] : []
    if (block.type !== 'table') return []
    return [
      ...(block.head.length > 1 ? [block.table.id] : []),
      ...block.guests.filter((item) => item.lines.length > 1).map((item) => item.guest.id),
    ]
  })

/**
 * A name wider than the room it has: on a plain list the table printed beside a name can take
 * the whole column at big letters, and the name is then drawn over it rather than wrapped.
 */
const crowded = (sheet: SheetLayout, doc: ListDocument, scale: number, measure: Measure): boolean => {
  const { type } = doc.design
  const over = (line: string, style: typeof type.name, room: number) => measure(line, style, scale) > room + 0.01
  return sheet.blocks.some((block) => {
    if (block.type === 'guest') {
      const room = block.w - (block.tableW ? block.tableW + LIST_TABLE_GAP * scale : 0)
      return room <= 0 || block.lines.some((line) => over(line, type.name, room))
    }
    if (block.type !== 'table') return false
    const inner = block.w - block.pad * 2
    return (
      block.guests.some((item) => item.lines.some((line) => over(line, type.name, inner))) ||
      block.head.some((line) => over(line, type.group, inner - block.headPad * 4))
    )
  })
}

/**
 * The columns and text size that fit the sheet to its paper: the fewest pages first (one,
 * whenever it can), then the biggest text that keeps it there with every name on one line
 * and within its room (one too long for a line even across the page at the smallest text may
 * wrap). Everything else is the sheet's own — who sits at which table, the order, the gaps, the flow, the paper — so a seating
 * board's rows follow from its tables and the columns chosen. Laid out on a grid: blocks moved
 * by hand would sit on top of it. Null for place cards (sized by the card, not the text) and
 * for a sheet with nothing on it.
 */
export const fitSheet = (doc: ListDocument, measure: Measure): Fit | null => {
  const { design, content } = doc
  if (design.kind === 'cards') return null
  const items = design.kind === 'seating' ? content.tables.length : content.guests.length
  if (!items) return null

  const layoutAt = (columns: number, textScale: number): SheetLayout =>
    layoutSheet(
      { ...doc, design: { ...design, textScale, layout: { ...design.layout, mode: 'grid', positions: {}, columns } } },
      measure
    )

  /**
   * Every block on its pages and inside the printable area (a table taller than a page is
   * not), every name within its room, and none wrapped but those that wrap anyway.
   */
  const fitsIn = (sheet: SheetLayout, scale: number, pages: number): boolean =>
    sheet.pages <= pages &&
    sheet.blocks.every(
      (block) =>
        block.y + block.h <= sheet.area.y + sheet.area.h + 0.01 &&
        block.x + block.w <= sheet.area.x + sheet.area.w + 0.01
    ) &&
    !crowded(sheet, doc, scale, measure) &&
    wrappedNames(sheet).every((id) => allowed.has(id))

  // Names too long for one line however the sheet is set: the widest column, the smallest text.
  const allowed = new Set(wrappedNames(layoutAt(1, FIT_SCALE.min)))
  const most = Math.min(design.kind === 'seating' ? MAX_COLUMNS : MAX_LIST_COLUMNS, items)
  const candidates = Array.from({ length: most }, (_, index) => index + 1)
  // The fewest pages any column count can reach, at the smallest text.
  const smallest = new Map(candidates.map((columns) => [columns, layoutAt(columns, FIT_SCALE.min)]))
  const reachable = candidates.filter((columns) =>
    fitsIn(smallest.get(columns)!, FIT_SCALE.min, smallest.get(columns)!.pages)
  )
  if (!reachable.length) return null
  const pages = Math.min(...reachable.map((columns) => smallest.get(columns)!.pages))

  let best: Fit | null = null
  for (const columns of reachable) {
    if (smallest.get(columns)!.pages > pages) continue
    let low: number = FIT_SCALE.min
    let high: number = FIT_SCALE.max
    if (fitsIn(layoutAt(columns, high), high, pages)) low = high
    else
      for (let step = 0; step < STEPS; step += 1) {
        const middle = (low + high) / 2
        if (fitsIn(layoutAt(columns, middle), middle, pages)) low = middle
        else high = middle
      }
    const textScale = Math.max(FIT_SCALE.min, Math.floor(low * 100) / 100)
    // Equal text: the column count already chosen stays.
    const closer = best && Math.abs(columns - design.layout.columns) < Math.abs(best.columns - design.layout.columns)
    if (!best || textScale > best.textScale + 0.001 || (Math.abs(textScale - best.textScale) <= 0.001 && closer))
      best = {
        columns,
        textScale,
        pages,
        rows: design.kind === 'seating' && design.layout.flow === 'rows' ? Math.ceil(items / columns) : 0,
      }
  }
  return best
}
