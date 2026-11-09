import { describe, expect, it } from 'vitest'
import type { ListDocument, PlanArrangement, TableShape, TextStyle } from '@store/lists/single/types'
import { resetDesign } from '@helpers/designReset'
import { fitSheet, startingPlanScale } from '@helpers/fitSheet'
import { newGuest, newTable, newVenueItem, templateDesign, withArrangement, withPlanFields } from '@helpers/listFactory'
import { layoutSheet, lineHeight, type Measure, type PlanTableBlock, roundDiameter, type SheetBlock, type SheetLayout } from '@helpers/sheetLayout'

/** Every character 2mm wide at scale 1: easy arithmetic, no fonts. */
const measure: Measure = (text, _style: TextStyle, scale) => Array.from(text).length * 2 * scale

const planDoc = (tables = 6, perTable = 6, patch: (doc: ListDocument) => void = () => undefined, shape: TableShape = 'round'): ListDocument => {
  const tableList = Array.from({ length: tables }, (_, index) => newTable(`T${index + 1}`, shape))
  const doc: ListDocument = {
    title: 'x',
    content: {
      heading: 'Hall',
      subheading: '',
      footer: '',
      tables: tableList,
      guests: tableList.flatMap((table, t) => Array.from({ length: perTable }, (_, g) => newGuest(`G${t}-${g}`, table.id))),
      venue: [newVenueItem('stage', 'Stage'), newVenueItem('dancefloor', 'Dance'), newVenueItem('entrance', 'In')],
    },
    design: templateDesign('classic', 'plan'),
  }
  patch(doc)
  return doc
}

const planBlocks = (sheet: SheetLayout): SheetBlock[] => sheet.blocks.filter((block) => block.type === 'plantable' || block.type === 'venue')

const overlap = (a: SheetBlock, b: SheetBlock): boolean =>
  a.page === b.page && a.x < b.x + b.w - 0.01 && b.x < a.x + a.w - 0.01 && a.y < b.y + b.h - 0.01 && b.y < a.y + a.h - 0.01

describe('the hall plan', () => {
  it('is landscape and draws every table and hall item, the hall first, without overlaps', () => {
    // Six tables of six do not fit one A4 at full size: they run onto a second page.
    const doc = planDoc()
    const sheet = layoutSheet(doc, measure)
    expect(sheet.width).toBeGreaterThan(sheet.height)
    const blocks = planBlocks(sheet)
    expect(blocks.map((block) => block.type)).toEqual(['venue', 'venue', 'venue', ...Array(6).fill('plantable')])
    for (const [index, block] of blocks.entries()) {
      expect(block.x).toBeGreaterThanOrEqual(sheet.area.x - 0.01)
      expect(block.x + block.w).toBeLessThanOrEqual(sheet.area.x + sheet.area.w + 0.01)
      for (const other of blocks.slice(index + 1)) expect(overlap(block, other)).toBe(false)
    }
    // The hall opens the plan: every table below the stage, the dance floor and the entrance.
    const hall = blocks.filter((block) => block.type === 'venue')
    expect(hall.every((block) => block.page === 0)).toBe(true)
    const hallBottom = Math.max(...hall.map((block) => block.y + block.h))
    for (const table of blocks.filter((block) => block.type === 'plantable' && block.page === 0)) expect(table.y).toBeGreaterThan(hallBottom)
  })

  it('fits a round table around its names: every line inside the circle', () => {
    const doc = planDoc(1, 9)
    const sheet = layoutSheet(doc, measure)
    const table = sheet.blocks.find((block): block is PlanTableBlock => block.type === 'plantable')
    expect(table?.shape).toBe('round')
    if (!table) return
    const { top } = table
    expect(top.w).toBeCloseTo(top.h, 5)
    const r = top.w / 2
    const cx = top.x + r
    const cy = top.y + r
    for (const { x, y, w, lines } of table.guests) {
      const h = lines.length * lineHeight(doc.design.type.name, doc.design.textScale)
      for (const [px, py] of [
        [x, y],
        [x + w, y],
        [x, y + h],
        [x + w, y + h],
      ])
        expect(Math.hypot(px - cx, py - cy)).toBeLessThanOrEqual(r + 0.01)
    }
  })

  it('draws a chair per guest, or the seats asked for when there are more', () => {
    const chairs = (seats: number) =>
      layoutSheet(planDoc(1, 5, (doc) => (doc.content.tables[0].seats = seats)), measure).blocks.find(
        (block): block is PlanTableBlock => block.type === 'plantable'
      )?.chairs.length
    expect(chairs(0)).toBe(5)
    expect(chairs(3)).toBe(5)
    expect(chairs(10)).toBe(10)
  })

  it('puts a long table’s names in columns, and more columns when it is widened', () => {
    const table = (doc: ListDocument) =>
      layoutSheet(doc, measure).blocks.find((block): block is PlanTableBlock => block.type === 'plantable')
    const narrow = table(planDoc(1, 12, () => undefined, 'rect'))
    expect(narrow?.shape).toBe('rect')
    expect(new Set(narrow?.guests.map((guest) => Math.round(guest.x))).size).toBe(2)
    const wide = table(planDoc(1, 12, (doc) => (doc.design.plan.sizes[doc.content.tables[0].id] = { w: 200, h: 30 }), 'rect'))
    expect(new Set(wide?.guests.map((guest) => Math.round(guest.x))).size).toBeGreaterThan(2)
    expect(wide?.w).toBeCloseTo(200, 5)
  })

  it('keeps blocks placed by hand where they are and puts a new table in a free spot', () => {
    const base = planDoc(4, 4)
    const placed = layoutSheet(base, measure)
    const positions = Object.fromEntries(planBlocks(placed).map((block) => [block.id, { page: block.page, x: block.x, y: block.y }]))
    const added = newTable('New')
    const doc = planDoc(0, 0, (next) => {
      next.content = { ...base.content, tables: [...base.content.tables, added] }
      next.design.plan.positions = positions
    })
    const sheet = layoutSheet(doc, measure)
    const blocks = planBlocks(sheet)
    for (const block of blocks) if (positions[block.id]) expect(block).toMatchObject(positions[block.id])
    const fresh = blocks.find((block) => block.id === added.id)
    expect(fresh).toBeDefined()
    if (!fresh) return
    for (const other of blocks) if (other !== fresh) expect(overlap(fresh, other)).toBe(false)
  })

  it('counts the guests without a table, which it cannot show', () => {
    const sheet = layoutSheet(planDoc(2, 3, (doc) => doc.content.guests.push(newGuest('Lost', ''))), measure)
    expect(sheet.unseated).toBe(1)
  })

  it('keeps its arrangement apart from the other kinds', () => {
    const doc = planDoc(2, 3)
    const id = doc.content.tables[0].id
    doc.design.plan.positions[id] = { page: 0, x: 100, y: 100 }
    const asPlan = layoutSheet(doc, measure).blocks.find((block) => block.id === id)
    expect(asPlan).toMatchObject({ x: 100, y: 100 })
    const asBoard = layoutSheet({ ...doc, design: { ...doc.design, kind: 'seating', layout: { ...doc.design.layout, mode: 'free' } } }, measure)
    expect(asBoard.blocks.find((block) => block.id === id)).not.toMatchObject({ x: 100, y: 100 })
  })

  it('is cleared by the layout reset, and filled in for a draft saved before it', () => {
    const doc = planDoc(1, 1)
    doc.design.plan.positions.t = { page: 0, x: 1, y: 1 }
    expect(resetDesign(doc.design, 'layout').plan).toEqual({ arrangement: 'rows', positions: {}, sizes: {} })

    const old = planDoc(1, 1) as unknown as { content: Record<string, unknown>; design: Record<string, unknown> }
    delete old.content.venue
    delete old.design.plan
    old.content.tables = [{ id: 't', name: 'T' }]
    const filled = withPlanFields(old as unknown as ListDocument)
    expect(filled.content.venue).toEqual([])
    expect(filled.content.tables[0]).toMatchObject({ shape: 'round', seats: 0 })
    expect(filled.design.plan).toEqual({ arrangement: 'rows', positions: {}, sizes: {} })
  })
})

describe('fitting the hall plan', () => {
  it('lets the app arrange it again, on one page, at smaller letters', () => {
    const doc = planDoc(6, 6, (next) => (next.design.plan.positions[next.content.tables[0].id] = { page: 0, x: 200, y: 150 }))
    expect(layoutSheet(doc, measure).pages).toBeGreaterThan(1)
    const fit = fitSheet(doc, measure)
    expect(fit).toMatchObject({ pages: 1, columns: 0 })
    const fitted = { ...doc, design: { ...doc.design, textScale: fit?.textScale ?? 1, plan: { arrangement: 'rows' as const, positions: {}, sizes: {} } } }
    expect(fit?.textScale).toBeLessThan(1)
    expect(layoutSheet(fitted, measure).pages).toBe(1)
  })
})

describe('roundDiameter', () => {
  it('is as small as the rows allow, and never smaller than the widest row', () => {
    // A single row's box, corner to corner.
    expect(roundDiameter([{ w: 20, h: 5 }], 0)).toBeCloseTo(Math.hypot(20, 5), 2)
    const stacked = roundDiameter(
      Array.from({ length: 5 }, () => ({ w: 20, h: 5 })),
      2
    )
    expect(stacked).toBeGreaterThan(24)
    expect(stacked).toBeLessThanOrEqual(Math.hypot(24, 29) + 0.01)
  })
})

describe('the hall arrangements', () => {
  /** Six tables of six set out by `arrangement`, at the text size it starts at. */
  const arrangedDoc = (arrangement: PlanArrangement, tables = 6): ListDocument => {
    const doc = withArrangement(planDoc(tables), arrangement)
    const textScale = startingPlanScale(doc, measure)
    return textScale === null ? doc : { ...doc, design: { ...doc.design, textScale } }
  }
  const byKind = (sheet: SheetLayout, kind: string) =>
    sheet.blocks.find((block) => block.type === 'venue' && block.item.kind === kind) as SheetBlock
  const centre = (block: SheetBlock) => ({ x: block.x + block.w / 2, y: block.y + block.h / 2 })

  for (const arrangement of ['around', 'sides', 'banquet'] as const) {
    it(`${arrangement}: one page, inside the printable area, nothing on top of anything, stage at the top and entrance at the bottom`, () => {
      const sheet = layoutSheet(arrangedDoc(arrangement), measure)
      expect(sheet.pages).toBe(1)
      expect(sheet.overflow).toBe(false)
      const blocks = planBlocks(sheet)
      for (const [index, block] of blocks.entries()) {
        expect(block.x).toBeGreaterThanOrEqual(sheet.area.x - 0.01)
        expect(block.x + block.w).toBeLessThanOrEqual(sheet.area.x + sheet.area.w + 0.01)
        expect(block.y + block.h).toBeLessThanOrEqual(sheet.area.y + sheet.area.h + 0.01)
        for (const other of blocks.slice(index + 1)) expect(overlap(block, other)).toBe(false)
      }
      const stage = byKind(sheet, 'stage')
      const entrance = byKind(sheet, 'entrance')
      const tables = blocks.filter((block) => block.type === 'plantable')
      expect(Math.min(...tables.map((block) => block.y))).toBeGreaterThan(stage.y + stage.h)
      expect(Math.max(...tables.map((block) => block.y + block.h))).toBeLessThan(entrance.y)
      expect(centre(stage).x).toBeCloseTo(sheet.area.x + sheet.area.w / 2, 5)
    })
  }

  it('around: round tables on every side of the dance floor', () => {
    const sheet = layoutSheet(arrangedDoc('around'), measure)
    const floor = centre(byKind(sheet, 'dancefloor'))
    const tables = sheet.blocks.filter((block): block is PlanTableBlock => block.type === 'plantable')
    expect(tables.every((table) => table.shape === 'round')).toBe(true)
    const spots = tables.map(centre)
    expect(spots.some((spot) => spot.x < floor.x - 1)).toBe(true)
    expect(spots.some((spot) => spot.x > floor.x + 1)).toBe(true)
    expect(spots.some((spot) => spot.y < floor.y - 1)).toBe(true)
    expect(spots.some((spot) => spot.y > floor.y + 1)).toBe(true)
  })

  it('sides: half the tables left of the dance floor, half right, none across it', () => {
    const sheet = layoutSheet(arrangedDoc('sides'), measure)
    const floor = byKind(sheet, 'dancefloor')
    const tables = sheet.blocks.filter((block) => block.type === 'plantable')
    expect(tables.filter((table) => table.x + table.w <= floor.x).length).toBe(3)
    expect(tables.filter((table) => table.x >= floor.x + floor.w).length).toBe(3)
  })

  it('banquet: long tables, every one below the dance floor under the stage', () => {
    const sheet = layoutSheet(arrangedDoc('banquet'), measure)
    const stage = byKind(sheet, 'stage')
    const floor = byKind(sheet, 'dancefloor')
    expect(floor.y).toBeGreaterThan(stage.y + stage.h)
    const tables = sheet.blocks.filter((block): block is PlanTableBlock => block.type === 'plantable')
    expect(tables.every((table) => table.shape === 'rect')).toBe(true)
    expect(tables.every((table) => table.y > floor.y + floor.h)).toBe(true)
  })

  it('sets a table added later out with the rest while nothing is placed by hand; once something is, it takes a free spot', () => {
    const doc = arrangedDoc('sides', 5)
    const added = { ...doc, content: { ...doc.content, tables: [...doc.content.tables, newTable('T6')] } }
    const sheet = layoutSheet(added, measure)
    const floor = byKind(sheet, 'dancefloor')
    const tables = sheet.blocks.filter((block) => block.type === 'plantable')
    expect(tables.filter((table) => table.x >= floor.x + floor.w).length).toBe(3)

    const first = tables[0]
    const pinned = {
      ...added,
      design: { ...added.design, plan: { ...added.design.plan, positions: { [first.id]: { page: 0, x: first.x, y: first.y } } } },
    }
    const again = layoutSheet(pinned, measure)
    expect(again.blocks.find((block) => block.id === first.id)).toMatchObject({ x: first.x, y: first.y })
  })

  it('says it does not fit when the tables overflow the room, so the text is made smaller', () => {
    const doc = withArrangement(planDoc(6), 'around')
    expect(layoutSheet(doc, measure).overflow).toBe(true)
    expect(startingPlanScale(doc, measure)).toBeLessThan(1)
  })

  it('a reset or a fit keeps the arrangement chosen', () => {
    const doc = arrangedDoc('banquet')
    expect(resetDesign(doc.design, 'layout').plan.arrangement).toBe('banquet')
    expect(resetDesign(doc.design, 'sizing').plan.arrangement).toBe('banquet')
    expect(fitSheet(doc, measure)).not.toBeNull()
  })
})
