import { describe, expect, it } from 'vitest'
import type { ListDocument, TextStyle } from '@store/lists/single/types'
import { FIT_SCALE, fitSheet } from '@helpers/fitSheet'
import { newGuest, newTable, templateDesign } from '@helpers/listFactory'
import { layoutSheet, type Measure } from '@helpers/sheetLayout'

/** Every character 2mm wide at scale 1: easy arithmetic, no fonts. */
const measure: Measure = (text, _style: TextStyle, scale) => Array.from(text).length * 2 * scale

const seating = (
  tables: number,
  perTable: number,
  patch: (doc: ListDocument) => void = () => undefined
): ListDocument => {
  const tableList = Array.from({ length: tables }, (_, index) => newTable(`Table ${index + 1}`))
  const doc: ListDocument = {
    title: 'x',
    content: {
      heading: 'Welcome',
      subheading: '',
      footer: '',
      tables: tableList,
      venue: [],
      guests: tableList.flatMap((table, t) =>
        Array.from({ length: perTable }, (_, g) => newGuest(`Guest ${t + 1}.${g + 1}`, table.id))
      ),
    },
    design: templateDesign('classic', 'seating'),
  }
  patch(doc)
  return doc
}

const applied = (doc: ListDocument, columns: number, textScale: number): ListDocument => ({
  ...doc,
  design: { ...doc.design, textScale, layout: { ...doc.design.layout, mode: 'grid', positions: {}, columns } },
})

const inside = (doc: ListDocument): boolean => {
  const sheet = layoutSheet(doc, measure)
  return sheet.blocks.every((block) => block.y + block.h <= sheet.area.y + sheet.area.h + 0.01)
}

describe('fitSheet', () => {
  it('fits a seating board on one page with the biggest text that stays there', () => {
    const doc = seating(12, 8)
    const fit = fitSheet(doc, measure)!
    expect(fit.pages).toBe(1)
    expect(fit.rows).toBe(Math.ceil(12 / fit.columns))
    const fitted = applied(doc, fit.columns, fit.textScale)
    expect(layoutSheet(fitted, measure).pages).toBe(1)
    expect(inside(fitted)).toBe(true)
    // A little bigger no longer fits with these columns.
    if (fit.textScale < FIT_SCALE.max)
      expect(layoutSheet(applied(doc, fit.columns, fit.textScale + 0.02), measure).pages).toBeGreaterThan(1)
  })

  it('shrinks a board that spills onto a second page, and grows one that leaves the page empty', () => {
    const crowded = seating(30, 10, (doc) => (doc.design.textScale = 1.5))
    expect(layoutSheet(crowded, measure).pages).toBeGreaterThan(1)
    const shrunk = fitSheet(crowded, measure)!
    expect(shrunk.pages).toBe(1)
    expect(shrunk.textScale).toBeLessThan(1.5)

    const sparse = seating(2, 3)
    expect(fitSheet(sparse, measure)!.textScale).toBeGreaterThan(sparse.design.textScale)
  })

  it('never moves anyone: only columns and the text size change', () => {
    const doc = seating(6, 5)
    const before = JSON.stringify(doc.content)
    fitSheet(doc, measure)
    expect(JSON.stringify(doc.content)).toBe(before)
  })

  it('takes the fewest pages when one is not enough even at the smallest text', () => {
    const huge = seating(40, 40)
    const fit = fitSheet(huge, measure)!
    expect(fit.pages).toBeGreaterThan(1)
    expect(layoutSheet(applied(huge, fit.columns, fit.textScale), measure).pages).toBe(fit.pages)
  })

  it('keeps every name on one line rather than making the text bigger', () => {
    const doc = seating(3, 4, (sheet) => {
      sheet.design.kind = 'list'
      sheet.content.guests[0].name = 'Aram Petrosyan-Hakobyan'
    })
    const fit = fitSheet(doc, measure)!
    const sheet = layoutSheet(applied(doc, fit.columns, fit.textScale), measure)
    for (const block of sheet.blocks) if (block.type === 'guest') expect(block.lines).toHaveLength(1)
  })

  it('has nothing to fit on place cards or an empty sheet', () => {
    expect(
      fitSheet(
        seating(3, 2, (doc) => (doc.design.kind = 'cards')),
        measure
      )
    ).toBeNull()
    expect(fitSheet(seating(0, 0), measure)).toBeNull()
  })
})

describe('fitSheet on a plain list with tables beside the names', () => {
  it('leaves each name room beside its table instead of drawing it over', () => {
    const doc = seating(3, 6, (sheet) => {
      sheet.design.kind = 'list'
      sheet.design.layout.showTable = true
    })
    const fit = fitSheet(doc, measure)!
    const sheet = layoutSheet(applied(doc, fit.columns, fit.textScale), measure)
    for (const block of sheet.blocks) {
      if (block.type !== 'guest') continue
      const room = block.w - block.tableW - 3 * fit.textScale
      for (const line of block.lines)
        expect(measure(line, doc.design.type.name, fit.textScale)).toBeLessThanOrEqual(room + 0.01)
    }
  })
})
