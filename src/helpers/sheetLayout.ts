import {
  FOOTER_ID,
  type Guest,
  type GuestTable,
  HEADER_ID,
  type ListDocument,
  type Paper,
  type Position,
  type SheetShape,
  type Size,
  type TextStyle,
} from '@store/lists/single/types'
import { PAPER_SIZES } from '@constants/paper'
import type { TableStyle } from '@constants/templates'
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
export type CardBlock = Box & { type: 'card'; guest: Guest; lines: Lines; tableName: string; note: string; faceH: number }

export type SheetBlock = HeaderBlock | FooterBlock | GuestBlock | TableBlock | CardBlock

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
  /** Seating: guests without a table, which a board cannot show. */
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
  const free = layout.mode === 'free'
  const pinned = (id: string): Position | undefined => (free ? layout.positions[id] : undefined)
  /**
   * A block resized by hand: its width kept within `natural` (its column, or the printable
   * width) in a grid, within the sheet when free; its height never less than its text needs.
   */
  const widthOf = (id: string, natural: number): number => {
    const size: Size | undefined = layout.sizes[id]
    return size ? Math.min(free ? width : natural, size.w) : natural
  }
  const heightOf = (id: string, needed: number): number => {
    const size: Size | undefined = layout.sizes[id]
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
        tableName,
        note: layout.showNote ? guest.note : '',
        faceH,
      }
      sized.push({ id: guest.id, w: colW, h: cardH, block })
    }
  } else if (design.kind === 'list') {
    const nameLH = lineHeight(type.name, scale)
    const ordered = sortGuests(content.guests, layout.sort)
    ordered.forEach((guest, index) => {
      const tableName = layout.showTable ? (tablesById.get(guest.tableId)?.name ?? '') : ''
      const tableW = tableName ? measure(tableName, type.name, scale) : 0
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
        h: heightOf(guest.id, Math.max(1, lines.length) * nameLH),
        guest,
        lines,
        tableName,
        tableW,
      }
      sized.push({ id: guest.id, w, h: block.h, block })
    })
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
  if (region) {
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
