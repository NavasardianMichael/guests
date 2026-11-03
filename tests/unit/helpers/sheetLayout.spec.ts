import { describe, expect, it } from 'vitest'
import { FOOTER_ID, HEADER_ID, type ListDocument, type TextStyle } from '@store/lists/single/types'
import { newGuest, newTable, templateDesign } from '@helpers/listFactory'
import { layoutSheet, type Measure, pageSize, type TableBlock, wrapText } from '@helpers/sheetLayout'

/** Every character 2mm wide at scale 1: easy arithmetic, no fonts. */
const measure: Measure = (text, _style: TextStyle, scale) => Array.from(text).length * 2 * scale

const docWith = (guests: number, tables = 0, patch: (doc: ListDocument) => void = () => undefined): ListDocument => {
  const tableList = Array.from({ length: tables }, (_, index) => newTable(`T${index + 1}`))
  const doc: ListDocument = {
    title: 'x',
    content: {
      heading: 'Welcome',
      subheading: '',
      footer: '',
      tables: tableList,
      guests: Array.from({ length: guests }, (_, index) => newGuest(`Guest ${index + 1}`, tableList.length ? tableList[index % tableList.length].id : '')),
    },
    design: templateDesign('classic', tables ? 'seating' : 'list'),
  }
  patch(doc)
  return doc
}

describe('pageSize', () => {
  it('turns a named size and uses a custom one as typed', () => {
    const doc = docWith(0)
    expect(pageSize(doc.design.paper)).toEqual({ width: 210, height: 297 })
    expect(pageSize({ ...doc.design.paper, orientation: 'landscape' })).toEqual({ width: 297, height: 210 })
    expect(pageSize({ ...doc.design.paper, format: 'custom', width: 500, height: 300 })).toEqual({ width: 500, height: 300 })
  })
})

describe('wrapText', () => {
  const style = templateDesign('classic').type.name
  it('wraps at words and breaks a word too long for the line', () => {
    expect(wrapText('aa bb cc', 10, style, 1, measure)).toEqual(['aa bb', 'cc'])
    expect(wrapText('abcdefgh', 6, style, 1, measure)).toEqual(['abc', 'def', 'gh'])
  })

  it('upper-cases when the style does', () => {
    expect(wrapText('Անի', 100, { ...style, uppercase: true }, 1, measure)).toEqual(['ԱՆԻ'])
  })
})

describe('layoutSheet', () => {
  it('puts the header first and the blocks below it, inside the margins', () => {
    const sheet = layoutSheet(docWith(10), measure)
    const header = sheet.blocks.find((block) => block.id === HEADER_ID)
    const guests = sheet.blocks.filter((block) => block.type === 'guest')
    expect(header?.y).toBe(sheet.area.y)
    expect(guests).toHaveLength(10)
    for (const block of guests) {
      expect(block.y).toBeGreaterThan((header?.y ?? 0) + (header?.h ?? 0))
      expect(block.x).toBeGreaterThanOrEqual(sheet.area.x)
      expect(block.x + block.w).toBeLessThanOrEqual(sheet.area.x + sheet.area.w + 0.001)
    }
  })

  it('flows onto more pages when a page is full', () => {
    const sheet = layoutSheet(docWith(400), measure)
    expect(sheet.pages).toBeGreaterThan(1)
    const lastPage = sheet.blocks.filter((block) => block.type === 'guest' && block.page === sheet.pages - 1)
    expect(lastPage.length).toBeGreaterThan(0)
  })

  it('fills columns top to bottom and balances them', () => {
    const sheet = layoutSheet(
      docWith(9, 0, (doc) => Object.assign(doc.design.layout, { columns: 3, flow: 'columns', balance: true })),
      measure
    )
    const xs = new Set(sheet.blocks.filter((block) => block.type === 'guest').map((block) => block.x))
    expect(xs.size).toBe(3)
    const perColumn = [...xs].map((x) => sheet.blocks.filter((block) => block.type === 'guest' && block.x === x).length)
    expect(perColumn).toEqual([3, 3, 3])
  })

  it('fills rows left to right', () => {
    const sheet = layoutSheet(docWith(4, 0, (doc) => Object.assign(doc.design.layout, { columns: 2, flow: 'rows' })), measure)
    const guests = sheet.blocks.filter((block) => block.type === 'guest')
    expect(guests[0].y).toBe(guests[1].y)
    expect(guests[2].y).toBeGreaterThan(guests[0].y)
  })

  it('groups guests under their tables and counts the unseated', () => {
    const doc = docWith(12, 3)
    doc.content.guests.push(newGuest('Nobody'))
    const sheet = layoutSheet(doc, measure)
    const tables = sheet.blocks.filter((block): block is TableBlock => block.type === 'table')
    expect(tables).toHaveLength(3)
    expect(tables.map((table) => table.guests.length)).toEqual([4, 4, 4])
    expect(sheet.unseated).toBe(1)
  })

  it('sorts the printout, not the list', () => {
    const doc = docWith(0, 0, (target) => {
      target.content.guests = ['Վահե', 'Անի', 'Գոռ'].map((name) => newGuest(name))
      target.design.layout.sort = 'az'
    })
    const names = layoutSheet(doc, measure)
      .blocks.filter((block) => block.type === 'guest')
      .map((block) => (block.type === 'guest' ? block.guest.name : ''))
    expect(names).toEqual(['Անի', 'Գոռ', 'Վահե'])
    expect(doc.content.guests[0].name).toBe('Վահե')
  })

  it('places dragged blocks where they were dropped in free mode only', () => {
    const doc = docWith(3)
    const id = doc.content.guests[0].id
    doc.design.layout.positions = { [id]: { page: 0, x: 100, y: 200 } }
    const grid = layoutSheet(doc, measure).blocks.find((block) => block.id === id)
    expect(grid?.x).not.toBe(100)
    doc.design.layout.mode = 'free'
    const free = layoutSheet(doc, measure).blocks.find((block) => block.id === id)
    expect(free).toMatchObject({ x: 100, y: 200, page: 0 })
  })

  it('cuts place cards edge to edge, as many across as fit, with no header', () => {
    const doc = docWith(10, 0, (target) => {
      target.design.kind = 'cards'
      Object.assign(target.design.layout, { cardWidth: 90, cardHeight: 50, gapX: 0, gapY: 0 })
    })
    const sheet = layoutSheet(doc, measure)
    const cards = sheet.blocks.filter((block) => block.type === 'card')
    expect(cards).toHaveLength(10)
    expect(new Set(cards.map((card) => card.x)).size).toBe(2)
    expect(sheet.blocks.some((block) => block.id === HEADER_ID || block.id === FOOTER_ID)).toBe(false)
  })

  it('doubles a tent card over its fold', () => {
    const doc = docWith(1, 0, (target) => {
      target.design.kind = 'cards'
      Object.assign(target.design.layout, { cardHeight: 50, cardFold: true })
    })
    expect(layoutSheet(doc, measure).blocks[0].h).toBe(100)
  })
})
