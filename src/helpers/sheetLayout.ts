import {
  FOOTER_ID,
  type Guest,
  type GuestTable,
  HEADER_ID,
  type ListDocument,
  type Paper,
  type Plan,
  type PlanArrangement,
  type Position,
  type SheetShape,
  type Size,
  type TableShape,
  type TextStyle,
  type VenueItem,
  type VenueKind,
} from '@store/lists/single/types'
import { PAPER_SIZES } from '@constants/paper'
import type { TableStyle } from '@constants/templates'
import { arrangeHall, type HallItem } from '@helpers/planArrangement'
import { type ShapeRegion, shapeRegion, sheetShapeOf } from '@helpers/sheetShape'

/**
 * Where everything sits on the sheet, in millimetres — computed, not left to CSS.
 *
 * A seating board is a fixed-size poster split into pages, with blocks the user may drag
 * anywhere, so the browser's flow layout cannot place it. This module does, for the editor,
 * every preview and the PDF alike (`SheetDocument` draws its result as absolutely placed
 * boxes). Text is wrapped here too, with the real font's metrics (`Measure`), and drawn line
 * by line, so a block's computed height is the height it prints at.
 *
 * A shaped sheet (`design.shape`) is laid out inside its outline (`helpers/sheetShape.ts`):
 * the title drops into an arch's curve until it has room, the footer rises off an oval's
 * bottom, and a block that would cross the edge moves down its column, or on to the next.
 *
 * Pure: the caller hands in `measure`, which in a browser is a canvas (`helpers/measureText.ts`)
 * and in a test a fixed-width stub.
 */

/** Width in mm of `text` set in `style` at `scale`. */
export type Measure = (text: string, style: TextStyle, scale: number) => number

export const PT_TO_MM = 25.4 / 72

/** Line height of every text, as a multiple of its size. The renderer uses the same number. */
export const LINE_HEIGHT = 1.3

/** A place card's name is set this much larger than the list's names. */
export const CARD_NAME_SCALE = 1.9

/** Inner spacing of a table block per style, mm at text scale 1. */
export const TABLE_STYLE_METRICS: Record<TableStyle, { pad: number; headPad: number; headGap: number }> = {
  plain: { pad: 0, headPad: 0, headGap: 1.8 },
  underline: { pad: 0, headPad: 0, headGap: 3.2 },
  boxed: { pad: 4, headPad: 0, headGap: 2.4 },
  filled: { pad: 4, headPad: 0, headGap: 2.4 },
  ribbon: { pad: 0, headPad: 1.6, headGap: 2.4 },
  badge: { pad: 0, headPad: 1.6, headGap: 2.4 },
}

const HEADER_TEXT_GAP = 2
/** Below the header: room for the template's divider ornament, then the body. */
const HEADER_AFTER = 9
const FOOTER_BEFORE = 6
const CARD_PAD = 5
/** A plain list: between a name and its table on the right, mm (scaled with the text). */
export const LIST_TABLE_GAP = 3

export type Lines = string[]

type Box = { id: string; page: number; x: number; y: number; w: number; h: number }

export type HeaderBlock = Box & { type: 'header'; heading: Lines; subheading: Lines; headingH: number }
export type FooterBlock = Box & { type: 'footer'; lines: Lines }
/** A name on a plain list; `tableName` as printed (the table names' case) and `tableW` its width in their style. */
export type GuestBlock = Box & { type: 'guest'; guest: Guest; lines: Lines; tableName: string; tableW: number }
export type TableBlock = Box & {
  type: 'table'
  table: GuestTable
  head: Lines
  headH: number
  pad: number
  headPad: number
  headGap: number
  guests: { guest: Guest; lines: Lines }[]
}
/** A place card; `tableName` and `note` as printed, in the case their text roles set. */
export type CardBlock = Box & { type: 'card'; guest: Guest; lines: Lines; tableName: string; note: string; faceH: number }

/** A box inside a block, mm from the block's corner. */
export type Inner = { x: number; y: number; w: number; h: number }

/**
 * A table on the hall plan: its top (`top`, a circle or a rectangle) with its name and its
 * guests inside, chairs around it. Everything is placed relative to the block's corner.
 */
export type PlanTableBlock = Box & {
  type: 'plantable'
  table: GuestTable
  shape: TableShape
  top: Inner
  /** A chair's diameter, mm; `chairs` are their centres. */
  chair: number
  chairs: { x: number; y: number }[]
  head: Inner & { lines: Lines }
  guests: { guest: Guest; lines: Lines; x: number; y: number; w: number }[]
}

/** A stage, dance floor or entrance on the hall plan, its label centred in it. */
export type VenueBlock = Box & { type: 'venue'; item: VenueItem; lines: Lines; textY: number }

export type SheetBlock = HeaderBlock | FooterBlock | GuestBlock | TableBlock | CardBlock | PlanTableBlock | VenueBlock

export type SheetLayout = {
  width: number
  height: number
  pages: number
  /** The printable area (inside the margins); on a shaped sheet, the box of the room inside its outline. */
  area: { x: number; y: number; w: number; h: number }
  /** The outline the sheet prints in (`rectangle` for place cards, whatever the design says). */
  shape: SheetShape
  /** A block too big for any place inside a shaped sheet's outline, printed across its edge. */
  overflow: boolean
  blocks: SheetBlock[]
  /** Seating and the hall plan: guests without a table, which they cannot show. */
  unseated: number
  /** A grid column's width, mm: the widest a block resized in a grid can be. */
  column: number
}

/** The sheet's size as printed, orientation applied. A custom size is used as typed. */
export const pageSize = (paper: Paper): { width: number; height: number } => {
  if (paper.format === 'custom') return { width: paper.width, height: paper.height }
  const { width, height } = PAPER_SIZES[paper.format]
  return paper.orientation === 'landscape' ? { width: height, height: width } : { width, height }
}

export const lineHeight = (style: TextStyle, scale: number): number => style.size * scale * PT_TO_MM * LINE_HEIGHT

const displayText = (text: string, style: TextStyle): string => (style.uppercase ? text.toUpperCase() : text)

/** Greedy word wrap; a word wider than the line is broken between letters. */
export const wrapText = (text: string, width: number, style: TextStyle, scale: number, measure: Measure): Lines => {
  const source = displayText(text, style).replace(/\s+/g, ' ').trim()
  if (!source) return []
  if (width <= 0) return [source]
  const lines: Lines = []
  let line = ''
  const pushWord = (word: string) => {
    if (measure(word, style, scale) <= width) {
      line = word
      return
    }
    // One overlong word: break it where it stops fitting.
    let chunk = ''
    for (const char of word) {
      if (chunk && measure(chunk + char, style, scale) > width) {
        lines.push(chunk)
        chunk = char
      } else chunk += char
    }
    line = chunk
  }
  for (const word of source.split(' ')) {
    if (!line) pushWord(word)
    else if (measure(`${line} ${word}`, style, scale) <= width) line = `${line} ${word}`
    else {
      lines.push(line)
      pushWord(word)
    }
  }
  if (line) lines.push(line)
  return lines
}

const collator = (() => {
  try {
    return new Intl.Collator('hy', { sensitivity: 'base', numeric: true })
  } catch {
    return new Intl.Collator(undefined, { sensitivity: 'base', numeric: true })
  }
})()

export const compareNames = (a: string, b: string): number => collator.compare(a.trim(), b.trim())

const sortGuests = (guests: Guest[], sort: ListDocument['design']['layout']['sort']): Guest[] => {
  if (sort === 'manual') return guests
  const sorted = [...guests].sort((a, b) => compareNames(a.name, b.name))
  return sort === 'za' ? sorted.reverse() : sorted
}

type Sized = { id: string; w: number; h: number }

type GridOptions = {
  columns: number
  /** Between two columns, mm: a shaped sheet's centred rows space their blocks by it. */
  gapX: number
  flow: 'rows' | 'columns'
  balance: boolean
  gapY: number
  x: (col: number) => number
  top: (page: number) => number
  bottom: number
}

/**
 * Grid placement of same-width blocks on as many pages as they need.
 * `top(page)` / `bottom` bound each page's body; `x(col)` is a column's left edge.
 */
const placeGrid = (items: Sized[], opts: GridOptions): Map<string, Position> => {
  const placed = new Map<string, Position>()
  const { columns, gapY, x, top, bottom } = opts
  if (!items.length) return placed

  if (opts.flow === 'rows') {
    let page = 0
    let y = top(0)
    for (let start = 0; start < items.length; start += columns) {
      const row = items.slice(start, start + columns)
      const rowH = Math.max(...row.map((item) => item.h))
      if (y + rowH > bottom && y > top(page) + 0.01) {
        page += 1
        y = top(page)
      }
      row.forEach((item, col) => placed.set(item.id, { page, x: x(col), y }))
      y += rowH + gapY
    }
    return placed
  }

  // Down each column, then the next; a page ends when its last column is full.
  type Slot = { item: Sized; page: number; col: number; y: number }
  const fill = (list: Sized[], firstPage: number, target: (page: number) => number): Slot[] => {
    const slots: Slot[] = []
    let page = firstPage
    let col = 0
    let y = top(page)
    for (const item of list) {
      const limit = target(page)
      if (y + item.h > limit && y > top(page) + 0.01) {
        col += 1
        if (col >= columns) {
          page += 1
          col = 0
        }
        y = top(page)
      }
      slots.push({ item, page, col, y })
      y += item.h + gapY
    }
    return slots
  }

  let slots = fill(items, 0, () => bottom)
  if (opts.balance && columns > 1) {
    // Even out the last page: its blocks spread over every column at about the same height.
    const lastPage = slots[slots.length - 1].page
    const firstIndex = slots.findIndex((slot) => slot.page === lastPage)
    const rest = slots.slice(firstIndex).map((slot) => slot.item)
    const total = rest.reduce((sum, item) => sum + item.h + gapY, -gapY)
    const tallest = Math.max(...rest.map((item) => item.h))
    const pageTop = top(lastPage)
    // Grow the target until the blocks fit in the columns there are.
    for (let target = Math.max(tallest, total / columns); target <= bottom - pageTop + 0.01; target += 2) {
      const attempt = fill(rest, lastPage, () => pageTop + target + 0.01)
      if (attempt.every((slot) => slot.page === lastPage)) {
        slots = [...slots.slice(0, firstIndex), ...attempt]
        break
      }
    }
  }
  for (const slot of slots) placed.set(slot.item.id, { page: slot.page, x: x(slot.col), y: slot.y })
  return placed
}

/** Between two tries of a lower place for a row or a text on a shaped sheet, mm. */
const SHAPE_STEP = 1

/**
 * `placeGrid` inside a shaped sheet's outline, where a block goes only where its whole box is
 * inside. Down a column (`columns` flow) the grid's columns stay where they are, and a block
 * moves down until it fits, or on to the next column. A row (`rows` flow) is centred in the
 * room at its height and takes as many blocks as fit side by side there, up to the column
 * count — one in an arch's tip, then two, then the full row — and moves down when not even one
 * fits. A block too big for any place on a whole page is printed at the page's top, across
 * the edge (`overflow`).
 */
const placeGridInShape = (items: Sized[], opts: GridOptions, region: ShapeRegion): { placed: Map<string, Position>; overflow: boolean } => {
  const placed = new Map<string, Position>()
  const { columns, gapX, gapY, x, top, bottom } = opts
  let overflow = false
  if (!items.length) return { placed, overflow }
  const middle = Math.floor((columns - 1) / 2)

  if (opts.flow === 'rows') {
    let page = 0
    let y = top(0)
    let onPage = 0
    let index = 0
    while (index < items.length) {
      let count = Math.min(columns, items.length - index)
      let room: [number, number] | null = null
      let rowH = 0
      let rowW = 0
      while (count > 0) {
        const row = items.slice(index, index + count)
        rowH = Math.max(...row.map((item) => item.h))
        rowW = Math.max(...row.map((item) => item.w))
        room = y + rowH <= bottom + 0.01 ? region.span(y, y + rowH) : null
        const fits = room ? Math.floor((room[1] - room[0] + gapX + 0.01) / (rowW + gapX)) : 0
        if (fits >= count) break
        count = Math.min(count - 1, fits)
      }
      if (count > 0 && room) {
        const start = (room[0] + room[1]) / 2 - (count * rowW + (count - 1) * gapX) / 2
        for (let offset = 0; offset < count; offset += 1) placed.set(items[index + offset].id, { page, x: start + offset * (rowW + gapX), y })
        index += count
        onPage += count
        y += rowH + gapY
        continue
      }
      if (y + SHAPE_STEP + items[index].h <= bottom + 0.01) {
        y += SHAPE_STEP
        continue
      }
      if (onPage === 0) {
        placed.set(items[index].id, { page, x: x(middle), y: top(page) })
        overflow = true
        index += 1
      }
      page += 1
      y = top(page)
      onPage = 0
    }
    return { placed, overflow }
  }

  type Slot = { item: Sized; page: number; col: number; y: number }
  const fill = (list: Sized[], firstPage: number, target: (page: number) => number): { slots: Slot[]; overflow: boolean } => {
    const slots: Slot[] = []
    let over = false
    let page = firstPage
    let col = 0
    let y = top(page)
    let onPage = 0
    for (const item of list) {
      for (;;) {
        const at = region.fitFrom(x(col), x(col) + item.w, y, item.h, Math.min(target(page), bottom))
        if (at !== null) {
          slots.push({ item, page, col, y: at })
          y = at + item.h + gapY
          onPage += 1
          break
        }
        col += 1
        if (col < columns) {
          y = top(page)
          continue
        }
        const forced = onPage === 0
        if (forced) {
          slots.push({ item, page, col: middle, y: top(page) })
          over = true
        }
        page += 1
        col = 0
        onPage = 0
        y = top(page)
        if (forced) break
      }
    }
    return { slots, overflow: over }
  }

  let result = fill(items, 0, () => bottom)
  if (opts.balance && columns > 1 && !result.overflow) {
    const { slots } = result
    const lastPage = slots[slots.length - 1].page
    const firstIndex = slots.findIndex((slot) => slot.page === lastPage)
    const rest = slots.slice(firstIndex).map((slot) => slot.item)
    const total = rest.reduce((sum, item) => sum + item.h + gapY, -gapY)
    const tallest = Math.max(...rest.map((item) => item.h))
    const pageTop = top(lastPage)
    for (let target = Math.max(tallest, total / columns); target <= bottom - pageTop + 0.01; target += 2) {
      const attempt = fill(rest, lastPage, () => pageTop + target + 0.01)
      if (!attempt.overflow && attempt.slots.every((slot) => slot.page === lastPage)) {
        result = { slots: [...slots.slice(0, firstIndex), ...attempt.slots], overflow: false }
        break
      }
    }
  }
  for (const slot of result.slots) placed.set(slot.item.id, { page: slot.page, x: x(slot.col), y: slot.y })
  return { placed, overflow: result.overflow }
}

/**
 * Where a title (from the top) or a closing line (from the bottom) sits inside a shaped
 * sheet's outline: as near the edge as there is room for it on its natural lines, or, for a
 * long text, for 70% of the sheet's width — so a title in an arch sits in the curve, not
 * squeezed into its tip. `heightAt(w)` is the text's height wrapped at `w`. Null when
 * there is no such place.
 */
const placeText = (
  region: ShapeRegion,
  from: 'top' | 'bottom',
  maxW: number,
  natural: number,
  heightAt: (w: number) => number
): { x: number; y: number; w: number } | null => {
  const { bounds } = region
  const want = Math.min(maxW, natural + 0.5, bounds.w * 0.7)
  for (let offset = 0; offset <= bounds.h / 2; offset += SHAPE_STEP) {
    let w = maxW
    // Narrower room means more lines, a taller band, and maybe narrower room still.
    for (let pass = 0; pass < 4 && w >= want - 0.01; pass += 1) {
      const h = heightAt(w)
      const y = from === 'top' ? bounds.y + offset : bounds.y + bounds.h - offset - h
      const room = region.span(y, y + h)
      if (!room) break
      const roomW = Math.min(maxW, room[1] - room[0])
      if (roomW >= w - 0.01) return { x: (room[0] + room[1]) / 2 - w / 2, y, w }
      w = roomW
    }
  }
  return null
}

/** The hall plan's measures, mm at text scale 1. */
export const PLAN = {
  /** A chair's diameter, and its gap to the table's edge. */
  chair: 4.2,
  chairGap: 1.2,
  /** Inside a table's top, around its texts. */
  pad: 3,
  /** Between a table's name and its first guest. */
  headGap: 1.6,
  /** A name longer than this wraps. */
  nameWrap: 44,
  /** Between two columns of names at a long table. */
  columnGap: 4,
  /** A long table puts this many names in a column before it starts another. */
  rowsPerColumn: 6,
  roundMin: 22,
  rectMin: { w: 30, h: 16 },
  /** A venue item's padding around its label. */
  venuePad: 2,
} as const

/** A venue item's size until the user resizes it, mm at text scale 1. */
export const VENUE_SIZES: Record<VenueKind, { w: number; h: number }> = {
  stage: { w: 90, h: 26 },
  dancefloor: { w: 64, h: 52 },
  entrance: { w: 34, h: 13 },
}

const EMPTY_PLAN: Plan = { arrangement: 'rows', positions: {}, sizes: {} }

/**
 * The smallest circle a stack of centred rows fits in, `pad` clear of its edge: each row (a
 * line of text, `w` wide and `h` tall) needs the circle's chord at its far edge to hold it.
 */
export const roundDiameter = (rows: { w: number; h: number }[], pad: number): number => {
  const total = rows.reduce((sum, row) => sum + row.h, 0)
  const widest = Math.max(0, ...rows.map((row) => row.w))
  const fits = (radius: number): boolean => {
    let y = -total / 2
    for (const row of rows) {
      const far = Math.max(Math.abs(y), Math.abs(y + row.h))
      if (row.w / 2 + pad > Math.sqrt(Math.max(0, radius * radius - far * far)) + 0.001) return false
      y += row.h
    }
    return true
  }
  let low = Math.max(total / 2, widest / 2) + pad
  // Here every row has at least `widest + 2 pad` across, however far out it sits.
  let high = Math.hypot(widest / 2 + pad, total / 2 + pad)
  if (fits(low)) return low * 2
  for (let step = 0; step < 24; step += 1) {
    const middle = (low + high) / 2
    if (fits(middle)) high = middle
    else low = middle
  }
  return high * 2
}

/** Where `count` chairs stand around a table top, by their centres, `offset` out from its edge. */
const chairsAround = (shape: TableShape, top: Inner, count: number, offset: number): { x: number; y: number }[] => {
  if (count <= 0) return []
  const cx = top.x + top.w / 2
  const cy = top.y + top.h / 2
  if (shape === 'round') {
    const radius = top.w / 2 + offset
    return Array.from({ length: count }, (_, index) => {
      const angle = -Math.PI / 2 + (index * 2 * Math.PI) / count
      return { x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) }
    })
  }
  // Along the two long sides, the odd one on the first.
  const wide = top.w >= top.h
  const first = Math.ceil(count / 2)
  const sides: [number, number][] = [
    [first, -1],
    [count - first, 1],
  ]
  return sides.flatMap(([n, side]) =>
    Array.from({ length: n }, (_, index) =>
      wide
        ? { x: top.x + (top.w * (index + 0.5)) / n, y: cy + side * (top.h / 2 + offset) }
        : { x: cx + side * (top.w / 2 + offset), y: top.y + (top.h * (index + 0.5)) / n }
    )
  )
}

type PlanOptions = {
  arrangement: PlanArrangement
  area: SheetLayout['area']
  gapX: number
  gapY: number
  top: (page: number) => number
  bottom: number
  region: ShapeRegion | null
}

const overlaps = (a: Box, b: Box, gap: number): boolean =>
  a.page === b.page &&
  a.x < b.x + b.w + gap - 0.01 &&
  b.x < a.x + a.w + gap - 0.01 &&
  a.y < b.y + b.h + gap - 0.01 &&
  b.y < a.y + a.h + gap - 0.01

/**
 * The hall plan's places for the blocks the user has not placed. With nothing placed yet, the
 * hall is set out as its arrangement has it: in centred rows, top to bottom — the stage, dance
 * floor and entrance first, then the tables — or by a preset (`arrangeHall`). Once blocks are placed by hand, each new one takes the first free spot (top to
 * bottom, left to right) clear of them, so adding a table never moves another.
 */
const placePlan = (
  items: HallItem[],
  positions: Record<string, Position>,
  opts: PlanOptions
): { placed: Map<string, Position>; overflow: boolean } => {
  const placed = new Map<string, Position>()
  const { arrangement, area, gapX, gapY, top, bottom, region } = opts
  let overflow = false
  /** The room across `y`..`y + h` (left, right), or null. */
  const roomAt = (y: number, h: number): [number, number] | null => {
    if (y + h > bottom + 0.01) return null
    return region ? region.span(y, y + h) : [area.x, area.x + area.w]
  }
  const loose = items.filter((item) => !positions[item.id])
  if (!loose.length) return { placed, overflow }

  if (loose.length === items.length && arrangement !== 'rows') {
    const room = { x: area.x, y: top(0), w: area.w, h: bottom - top(0), gap: Math.min(gapX, gapY), region }
    const hall = arrangeHall(arrangement, items, room)
    for (const [id, at] of hall.placed) placed.set(id, { page: 0, ...at })
    return { placed, overflow: hall.overflow }
  }

  if (loose.length === items.length) {
    let page = 0
    let y = top(0)
    let onPage = 0
    let index = 0
    while (index < loose.length) {
      let count = 0
      let rowW = 0
      let rowH = 0
      let room: [number, number] | null = null
      while (index + count < loose.length) {
        const item = loose[index + count]
        const h = Math.max(rowH, item.h)
        const w = rowW + (count ? gapX : 0) + item.w
        const span = roomAt(y, h)
        if (!span || w > span[1] - span[0] + 0.01) break
        rowW = w
        rowH = h
        room = span
        count += 1
      }
      if (count > 0 && room) {
        let x = (room[0] + room[1]) / 2 - rowW / 2
        for (const item of loose.slice(index, index + count)) {
          placed.set(item.id, { page, x, y: y + (rowH - item.h) / 2 })
          x += item.w + gapX
        }
        index += count
        onPage += count
        y += rowH + gapY
        continue
      }
      const item = loose[index]
      const span = roomAt(y, item.h)
      // Wider than the sheet: on a row of its own, across the edge.
      if (span && !region && item.w > span[1] - span[0]) {
        placed.set(item.id, { page, x: span[0], y })
        overflow = true
        index += 1
        onPage += 1
        y += item.h + gapY
        continue
      }
      // A shaped sheet may have room lower down.
      if (region && y + SHAPE_STEP + item.h <= bottom + 0.01) {
        y += SHAPE_STEP
        continue
      }
      if (onPage === 0) {
        placed.set(item.id, { page, x: area.x + area.w / 2 - item.w / 2, y: top(page) })
        overflow = true
        index += 1
      }
      page += 1
      y = top(page)
      onPage = 0
    }
    return { placed, overflow }
  }

  const taken: Box[] = items.flatMap((item) => {
    const at = positions[item.id]
    return at ? [{ id: item.id, page: at.page, x: at.x, y: at.y, w: item.w, h: item.h }] : []
  })
  const gap = Math.min(gapX, gapY)
  const lastPage = Math.max(0, ...taken.map((box) => box.page))
  for (const item of loose) {
    let spot: Position | null = null
    for (let page = 0; page <= lastPage + 1 && !spot; page += 1) {
      const here = taken.filter((box) => box.page === page)
      const xs = [area.x, ...here.map((box) => box.x + box.w + gapX)]
      const ys = [top(page), ...here.map((box) => box.y + box.h + gapY)].filter((y) => y >= top(page) - 0.01).sort((a, b) => a - b)
      for (const y of ys) {
        const span = roomAt(y, item.h)
        if (!span) continue
        const x = [...xs, (span[0] + span[1]) / 2 - item.w / 2]
          .filter((at) => at >= span[0] - 0.01 && at + item.w <= span[1] + 0.01)
          .sort((a, b) => a - b)
          .find((at) => !here.some((box) => overlaps(box, { id: item.id, page, x: at, y, w: item.w, h: item.h }, gap)))
        if (x !== undefined) {
          spot = { page, x, y }
          break
        }
      }
    }
    if (!spot) {
      spot = { page: lastPage + 1, x: area.x, y: top(lastPage + 1) }
      overflow = true
    }
    placed.set(item.id, spot)
    taken.push({ id: item.id, ...spot, w: item.w, h: item.h })
  }
  return { placed, overflow }
}

/**
 * A shaped sheet's grid: its columns span the room across the middle third of the outline,
 * not the outline's box — the full width of a wavy or scalloped edge exists only at its
 * crests, an oval's only at its very middle. Top to bottom it is the outline's.
 */
const gridArea = (region: ShapeRegion): SheetLayout['area'] => {
  const { bounds } = region
  const room = region.span(bounds.y + bounds.h / 3, bounds.y + (bounds.h * 2) / 3) ?? [bounds.x, bounds.x + bounds.w]
  return { x: room[0], y: bounds.y, w: room[1] - room[0], h: bounds.h }
}

/** Lays out a whole document. */
export const layoutSheet =(doc: ListDocument, measure: Measure): SheetLayout => {
  const { content, design } = doc
  const { layout, type } = design
  const scale = design.textScale
  const { width, height } = pageSize(design.paper)
  const margin = Math.min(design.paper.margin, width / 3, height / 3)
  const shape = sheetShapeOf(design)
  const region = shape === 'rectangle' ? null : shapeRegion(shape, width, height, margin)
  const area = region ? gridArea(region) : { x: margin, y: margin, w: width - margin * 2, h: height - margin * 2 }
  let overflow = false
  const blocks: SheetBlock[] = []
  const tablesById = new Map(content.tables.map((table) => [table.id, table]))
  const isPlan = design.kind === 'plan'
  // The hall plan keeps its own arrangement, and every block on it is free.
  const placement = isPlan ? (design.plan ?? EMPTY_PLAN) : layout
  const free = isPlan || layout.mode === 'free'
  const pinned = (id: string): Position | undefined => (free ? placement.positions[id] : undefined)
  /**
   * A block resized by hand: its width kept within `natural` (its column, or the printable
   * width) in a grid, within the sheet when free; its height never less than its text needs.
   */
  const widthOf = (id: string, natural: number): number => {
    const size: Size | undefined = placement.sizes[id]
    return size ? Math.min(free ? width : natural, size.w) : natural
  }
  const heightOf = (id: string, needed: number): number => {
    const size: Size | undefined = placement.sizes[id]
    return size ? Math.max(needed, size.h) : needed
  }

  // Header and footer: not on place cards, which are cut apart.
  const isCards = design.kind === 'cards'
  /** The widest line of `texts` unwrapped: how wide a text set on its own lines is. */
  const naturalWidth = (texts: [string, TextStyle][]): number =>
    Math.max(0, ...texts.flatMap(([text, style]) => wrapText(text, Infinity, style, scale, measure).map((line) => measure(line, style, scale))))

  const headerMaxW = widthOf(HEADER_ID, area.w)
  const headerAt = (w: number) => {
    const heading = isCards ? [] : wrapText(content.heading, w, type.heading, scale, measure)
    const subheading = isCards ? [] : wrapText(content.subheading, w, type.subheading, scale, measure)
    const headingH = heading.length * lineHeight(type.heading, scale)
    const subH = subheading.length * lineHeight(type.subheading, scale)
    const h =
      heading.length + subheading.length > 0
        ? heightOf(HEADER_ID, headingH + (heading.length && subheading.length ? HEADER_TEXT_GAP * scale : 0) + subH)
        : 0
    return { heading, subheading, headingH, h }
  }
  let headerBox = { x: area.x, y: area.y, w: headerMaxW }
  let header = headerAt(headerMaxW)
  if (region && header.h > 0) {
    const natural = naturalWidth([
      [content.heading, type.heading],
      [content.subheading, type.subheading],
    ])
    const at = placeText(region, 'top', headerMaxW, natural, (w) => headerAt(w).h)
    if (at) {
      headerBox = at
      header = headerAt(at.w)
    } else overflow = true
  }
  const { heading, subheading, headingH } = header
  const headerH = header.h
  const hasHeader = headerH > 0
  const headerSpace = hasHeader ? headerH + HEADER_AFTER * scale : 0

  const footerMaxW = widthOf(FOOTER_ID, area.w)
  const footerAt = (w: number) => {
    const lines = isCards ? [] : wrapText(content.footer, w, type.footer, scale, measure)
    return { lines, h: lines.length ? heightOf(FOOTER_ID, lines.length * lineHeight(type.footer, scale)) : 0 }
  }
  let footer = footerAt(footerMaxW)
  let footerBox = { x: area.x, y: area.y + area.h - footer.h, w: footerMaxW }
  if (region && footer.h > 0) {
    const at = placeText(region, 'bottom', footerMaxW, naturalWidth([[content.footer, type.footer]]), (w) => footerAt(w).h)
    if (at) {
      footerBox = at
      footer = footerAt(at.w)
    } else overflow = true
  }
  const footerLines = footer.lines
  const footerH = footer.h

  const bodyTop = (page: number): number => (page === 0 || layout.headerOnEveryPage ? headerBox.y + headerSpace : area.y)
  const bodyBottom = footerLines.length ? footerBox.y - FOOTER_BEFORE * scale : area.y + area.h

  // The blocks of the body, each sized.
  let columns = Math.max(1, Math.min(12, Math.round(layout.columns)))
  let colW = (area.w - layout.gapX * (columns - 1)) / columns
  let gapX = layout.gapX
  const sized: (Sized & { block: SheetBlock })[] = []
  let unseated = 0

  if (design.kind === 'cards') {
    const faceH = layout.cardHeight
    const cardH = layout.cardFold ? faceH * 2 : faceH
    colW = Math.min(layout.cardWidth, area.w)
    gapX = layout.gapX
    columns = Math.max(1, Math.floor((area.w + gapX + 0.01) / (colW + gapX)))
    const nameStyle = { ...type.name, size: type.name.size * CARD_NAME_SCALE }
    const inner = colW - CARD_PAD * 2
    for (const guest of sortGuests(content.guests, layout.sort)) {
      const tableName = layout.showTable ? (tablesById.get(guest.tableId)?.name ?? '') : ''
      const block: CardBlock = {
        type: 'card',
        id: guest.id,
        page: 0,
        x: 0,
        y: 0,
        w: colW,
        h: cardH,
        guest,
        lines: wrapText(guest.name, inner, nameStyle, scale, measure),
        tableName: displayText(tableName, type.group),
        note: layout.showNote ? displayText(guest.note, type.subheading) : '',
        faceH,
      }
      sized.push({ id: guest.id, w: colW, h: cardH, block })
    }
  } else if (design.kind === 'list') {
    const nameLH = lineHeight(type.name, scale)
    // The table beside each name is set in the table names' style (`type.group`), as on a board.
    const tableLH = lineHeight(type.group, scale)
    const ordered = sortGuests(content.guests, layout.sort)
    ordered.forEach((guest, index) => {
      const tableName = layout.showTable ? displayText(tablesById.get(guest.tableId)?.name ?? '', type.group) : ''
      const tableW = tableName ? measure(tableName, type.group, scale) : 0
      const text = layout.numbering ? `${index + 1}. ${guest.name}` : guest.name
      const w = widthOf(guest.id, colW)
      const nameW = w - (tableW ? tableW + LIST_TABLE_GAP * scale : 0)
      const lines = wrapText(text, nameW, type.name, scale, measure)
      const block: GuestBlock = {
        type: 'guest',
        id: guest.id,
        page: 0,
        x: 0,
        y: 0,
        w,
        h: heightOf(guest.id, Math.max(Math.max(1, lines.length) * nameLH, tableName ? tableLH : 0)),
        guest,
        lines,
        tableName,
        tableW,
      }
      sized.push({ id: guest.id, w, h: block.h, block })
    })
  } else if (isPlan) {
    const groupLH = lineHeight(type.group, scale)
    const nameLH = lineHeight(type.name, scale)
    const chair = PLAN.chair * scale
    const chairGap = PLAN.chairGap * scale
    const ring = chair + chairGap
    const pad = PLAN.pad * scale
    const headGap = PLAN.headGap * scale
    const wrapAt = PLAN.nameWrap * scale
    const venuePad = PLAN.venuePad * scale
    const byTable = new Map<string, Guest[]>()
    for (const guest of content.guests) {
      if (!tablesById.has(guest.tableId)) {
        unseated += 1
        continue
      }
      const list = byTable.get(guest.tableId) ?? []
      list.push(guest)
      byTable.set(guest.tableId, list)
    }
    const widest = (lines: Lines, style: TextStyle): number => Math.max(0, ...lines.map((line) => measure(line, style, scale)))

    // The hall first: a fresh plan starts with the stage at the top.
    for (const item of content.venue ?? []) {
      const size: Size | undefined = placement.sizes[item.id]
      const w = size ? size.w : VENUE_SIZES[item.kind].w * scale
      const lines = wrapText(item.label, Math.max(1, w - venuePad * 2), type.group, scale, measure)
      const textH = lines.length * groupLH
      const h = Math.max(size ? size.h : VENUE_SIZES[item.kind].h * scale, textH + venuePad * 2)
      const block: VenueBlock = { type: 'venue', id: item.id, page: 0, x: 0, y: 0, w, h, item, lines, textY: (h - textH) / 2 }
      sized.push({ id: item.id, w, h, block })
    }

    for (const table of content.tables) {
      const shape: TableShape = table.shape === 'rect' ? 'rect' : 'round'
      const size: Size | undefined = placement.sizes[table.id]
      const guests = sortGuests(byTable.get(table.id) ?? [], layout.sort).map((guest) => {
        const lines = wrapText(guest.name, wrapAt, type.name, scale, measure)
        return { guest, lines, w: widest(lines, type.name) }
      })
      const placedGuests: PlanTableBlock['guests'] = []
      const chairCount = Math.max(table.seats ?? 0, guests.length)
      // Chairs half a chair apart: a table is at least long enough to seat them all.
      const pitch = chair * 1.5
      let head: Lines
      let topW: number
      let topH: number
      let contentH: number

      if (shape === 'round') {
        head = wrapText(table.name, wrapAt, type.group, scale, measure)
        const rows = [
          ...head.map((line) => ({ w: measure(line, type.group, scale), h: groupLH })),
          ...(head.length && guests.length ? [{ w: 0, h: headGap }] : []),
          ...guests.flatMap(({ lines }) => lines.map((line) => ({ w: measure(line, type.name, scale), h: nameLH }))),
        ]
        // A resized round table takes its larger side as its diameter.
        const wanted = size ? Math.max(size.w, size.h) - ring * 2 : 0
        const seated = (chairCount * pitch) / Math.PI - (chairGap + chair / 2) * 2
        topW = Math.max(PLAN.roundMin * scale, roundDiameter(rows, pad), wanted, seated)
        topH = topW
        contentH = rows.reduce((sum, row) => sum + row.h, 0)
        let y = (topH - contentH) / 2 + head.length * groupLH + (head.length && guests.length ? headGap : 0)
        for (const { guest, lines, w } of guests) {
          // Each name as wide as its own lines and centred: off its middle the circle is narrower.
          placedGuests.push({ guest, lines, x: (topW - w) / 2, y, w })
          y += Math.max(1, lines.length) * nameLH
        }
      } else {
        // A long table: its names in columns of up to `rowsPerColumn`, or as many as its width takes.
        const colW = Math.max(10 * scale, ...guests.map(({ w }) => w))
        const gap = PLAN.columnGap * scale
        let columns = Math.max(1, Math.ceil(guests.length / PLAN.rowsPerColumn))
        let innerW = columns * colW + (columns - 1) * gap
        if (size) {
          innerW = Math.max(colW, size.w - ring * 2 - pad * 2)
          columns = Math.max(1, Math.floor((innerW + gap + 0.01) / (colW + gap)))
        }
        head = wrapText(table.name, size ? innerW : Math.max(innerW, wrapAt), type.group, scale, measure)
        if (!size) innerW = Math.max(innerW, widest(head, type.group))
        const rows = Array.from({ length: Math.ceil(guests.length / columns) }, (_, row) => guests.slice(row * columns, (row + 1) * columns))
        const rowHeights = rows.map((row) => Math.max(...row.map(({ lines }) => Math.max(1, lines.length))) * nameLH)
        const headH = head.length * groupLH
        contentH = headH + (head.length && guests.length ? headGap : 0) + rowHeights.reduce((sum, h) => sum + h, 0)
        topW = Math.max(PLAN.rectMin.w * scale, innerW + pad * 2, Math.ceil(chairCount / 2) * pitch)
        topH = Math.max(PLAN.rectMin.h * scale, contentH + pad * 2, size ? size.h - ring * 2 : 0)
        const used = Math.min(columns, Math.max(1, guests.length))
        const gridW = used * colW + (used - 1) * gap
        let y = (topH - contentH) / 2 + headH + (head.length && guests.length ? headGap : 0)
        rows.forEach((row, index) => {
          row.forEach(({ guest, lines }, col) => placedGuests.push({ guest, lines, x: (topW - gridW) / 2 + col * (colW + gap), y, w: colW }))
          y += rowHeights[index]
        })
      }

      const top: Inner = { x: ring, y: ring, w: topW, h: topH }
      const headW = Math.max(1, widest(head, type.group))
      const block: PlanTableBlock = {
        type: 'plantable',
        id: table.id,
        page: 0,
        x: 0,
        y: 0,
        w: topW + ring * 2,
        h: topH + ring * 2,
        table,
        shape,
        top,
        chair,
        chairs: chairsAround(shape, top, chairCount, chairGap + chair / 2),
        head: { x: ring + (topW - headW) / 2, y: ring + (topH - contentH) / 2, w: headW, h: head.length * groupLH, lines: head },
        guests: placedGuests.map((item) => ({ ...item, x: item.x + ring, y: item.y + ring })),
      }
      sized.push({ id: table.id, w: block.w, h: block.h, block })
    }
  } else {
    const metrics = TABLE_STYLE_METRICS[design.tableStyle]
    const pad = metrics.pad * scale
    const headPad = metrics.headPad * scale
    const headGap = metrics.headGap * scale
    const groupLH = lineHeight(type.group, scale)
    const nameLH = lineHeight(type.name, scale)
    const byTable = new Map<string, Guest[]>()
    for (const guest of content.guests) {
      if (!tablesById.has(guest.tableId)) {
        unseated += 1
        continue
      }
      const list = byTable.get(guest.tableId) ?? []
      list.push(guest)
      byTable.set(guest.tableId, list)
    }
    for (const table of content.tables) {
      const w = widthOf(table.id, colW)
      const inner = w - pad * 2
      const head = wrapText(table.name, inner - headPad * 4, type.group, scale, measure)
      const headH = Math.max(1, head.length) * groupLH + headPad * 2
      const guests = sortGuests(byTable.get(table.id) ?? [], layout.sort).map((guest) => ({
        guest,
        lines: wrapText(guest.name, inner, type.name, scale, measure),
      }))
      const bodyH = guests.reduce((sum, item) => sum + Math.max(1, item.lines.length) * nameLH, 0)
      const h = heightOf(table.id, pad * 2 + headH + (guests.length ? headGap + bodyH : 0))
      const block: TableBlock = {
        type: 'table',
        id: table.id,
        page: 0,
        x: 0,
        y: 0,
        w,
        h,
        table,
        head,
        headH,
        pad,
        headPad,
        headGap,
        guests,
      }
      sized.push({ id: table.id, w, h, block })
    }
  }

  const gridOptions: GridOptions = {
    columns,
    gapX,
    flow: layout.flow,
    balance: layout.balance,
    gapY: layout.gapY,
    x: (col) => area.x + col * (colW + gapX),
    top: bodyTop,
    bottom: bodyBottom,
  }
  let grid: Map<string, Position>
  if (isPlan) {
    const hallItems = sized.map(({ id, w, h, block }) => ({ id, w, h, venue: block.type === 'venue' ? block.item.kind : undefined }))
    const onPlan = placePlan(hallItems, placement.positions, { arrangement: design.plan?.arrangement ?? 'rows', area, gapX: layout.gapX, gapY: layout.gapY, top: bodyTop, bottom: bodyBottom, region })
    grid = onPlan.placed
    overflow ||= onPlan.overflow
  } else if (region) {
    const inShape = placeGridInShape(sized, gridOptions, region)
    grid = inShape.placed
    overflow ||= inShape.overflow
  } else grid = placeGrid(sized, gridOptions)

  let pages = 1
  for (const item of sized) {
    const position = pinned(item.id) ?? grid.get(item.id) ?? { page: 0, x: area.x, y: area.y }
    Object.assign(item.block, position)
    pages = Math.max(pages, position.page + 1)
    blocks.push(item.block)
  }

  const headerPages = layout.headerOnEveryPage ? pages : 1
  if (hasHeader) {
    const at = pinned(HEADER_ID)
    for (let page = 0; page < headerPages; page += 1) {
      blocks.push({
        type: 'header',
        id: HEADER_ID,
        page,
        x: at?.x ?? headerBox.x,
        y: at?.y ?? headerBox.y,
        w: headerBox.w,
        h: headerH,
        heading,
        subheading,
        headingH,
      })
    }
  }
  if (footerLines.length) {
    const at = pinned(FOOTER_ID)
    const firstPage = layout.headerOnEveryPage ? 0 : pages - 1
    for (let page = firstPage; page < pages; page += 1) {
      blocks.push({
        type: 'footer',
        id: FOOTER_ID,
        page,
        x: at?.x ?? footerBox.x,
        y: at?.y ?? footerBox.y,
        w: footerBox.w,
        h: footerH,
        lines: footerLines,
      })
    }
  }

  return { width, height, pages, area, shape, overflow, blocks, unseated, column: colW }
}

export const round = (value: number, step = 0.1): number => Math.round(value / step) * step

/** Keeps a block's corner on its page. */
export const clampToPage = (position: Position, size: { w: number; h: number }, sheet: SheetLayout): Position => ({
  page: Math.max(0, position.page),
  x: Math.min(Math.max(0, position.x), Math.max(0, sheet.width - size.w)),
  y: Math.min(Math.max(0, position.y), Math.max(0, sheet.height - size.h)),
})
