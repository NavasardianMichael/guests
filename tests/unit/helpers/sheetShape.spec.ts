import { describe, expect, it } from 'vitest'
import { type ListDocument, SHEET_SHAPES, type SheetShape, type TextStyle } from '@store/lists/single/types'
import { TEMPLATE_FRAMES } from '@constants/templateFrames'
import { newGuest, newTable, templateDesign } from '@helpers/listFactory'
import { layoutSheet, type Measure } from '@helpers/sheetLayout'
import { type Point, shapeArt, shapeBox, shapeOutline, shapeRegion, sheetShapeOf } from '@helpers/sheetShape'

/** Every character 2mm wide at scale 1, as in `sheetLayout.spec.ts`. */
const measure: Measure = (text, _style: TextStyle, scale) => Array.from(text).length * 2 * scale

const SHAPED = SHEET_SHAPES.filter((shape) => shape !== 'rectangle')
const PAGES = [
  { width: 210, height: 297 },
  { width: 297, height: 210 },
  { width: 420, height: 594 },
]

const inside = (point: Point, polygon: Point[]): boolean => {
  let result = false
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index, index += 1) {
    const a = polygon[index]
    const b = polygon[previous]
    if (a.y > point.y !== b.y > point.y && point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x) result = !result
  }
  return result
}

const boxInside = (box: { x: number; y: number; w: number; h: number }, polygon: Point[]): boolean => {
  // Corners and points along each edge, a hair inside the box.
  const e = 0.3
  const points: Point[] = []
  for (let t = 0; t <= 1; t += 0.1) {
    points.push({ x: box.x + e + (box.w - 2 * e) * t, y: box.y + e })
    points.push({ x: box.x + e + (box.w - 2 * e) * t, y: box.y + box.h - e })
    points.push({ x: box.x + e, y: box.y + e + (box.h - 2 * e) * t })
    points.push({ x: box.x + box.w - e, y: box.y + e + (box.h - 2 * e) * t })
  }
  return points.every((point) => inside(point, polygon))
}

const seatingDoc = (shape: SheetShape, tables = 8, patch: (doc: ListDocument) => void = () => undefined): ListDocument => {
  const tableList = Array.from({ length: tables }, (_, index) => newTable(`Table ${index + 1}`))
  const doc: ListDocument = {
    title: 'x',
    content: {
      heading: 'Welcome to our wedding',
      subheading: '12 June',
      footer: 'With love',
      tables: tableList,
      venue: [],
      guests: Array.from({ length: tables * 5 }, (_, index) => newGuest(`Guest ${index + 1}`, tableList[index % tables].id)),
    },
    design: templateDesign('classic', 'seating', shape),
  }
  patch(doc)
  return doc
}

describe('shapeOutline', () => {
  it('draws every shape inside its page, and an inset outline inside the outer one', () => {
    for (const { width, height } of PAGES)
      for (const shape of SHEET_SHAPES) {
        const box = shapeBox(shape, width, height)
        const outer = shapeOutline(shape, box, 0)
        for (const point of outer) {
          expect(point.x).toBeGreaterThanOrEqual(-0.01)
          expect(point.y).toBeGreaterThanOrEqual(-0.01)
          expect(point.x).toBeLessThanOrEqual(width + 0.01)
          expect(point.y).toBeLessThanOrEqual(height + 0.01)
        }
        // A slightly shrunk outer outline, so points on a shared straight edge count as inside.
        const cx = width / 2
        const cy = height / 2
        const grown = shapeOutline(shape, box, -0.5)
        for (const point of shapeOutline(shape, box, 15)) expect(inside(point, grown), `${shape} ${width}x${height}`).toBe(true)
        expect(inside({ x: cx, y: cy }, outer)).toBe(true)
      }
  })

  it('keeps a circle round on any page', () => {
    const box = shapeBox('circle', 297, 210)
    expect(box).toEqual({ x: 43.5, y: 0, w: 210, h: 210 })
  })
})

describe('shapeRegion', () => {
  it('has room across the middle and none outside the outline', () => {
    for (const shape of SHAPED) {
      const region = shapeRegion(shape, 210, 297, 15)
      const middle = region.bounds.y + region.bounds.h / 2
      const room = region.span(middle - 5, middle + 5)
      expect(room, shape).not.toBeNull()
      expect(room![1] - room![0]).toBeGreaterThan(100)
      expect(region.span(region.bounds.y - 10, region.bounds.y)).toBeNull()
    }
  })

  it('finds the first place a box fits, lower in a curve', () => {
    const region = shapeRegion('arch', 210, 297, 15)
    // A wide box cannot sit in the arch's tip: it goes down to where the curve is wide enough.
    const wide = region.fitFrom(30, 180, region.bounds.y, 20, 297)
    expect(wide).not.toBeNull()
    expect(wide!).toBeGreaterThan(region.bounds.y + 20)
    // A narrow box in the middle fits near the top.
    const narrow = region.fitFrom(100, 110, region.bounds.y, 10, 297)
    expect(narrow!).toBeLessThan(region.bounds.y + 3)
  })
})

describe('layoutSheet on a shaped sheet', () => {
  it('keeps every block inside the outline at the margin', () => {
    for (const { width, height } of PAGES)
      for (const shape of SHAPED)
        for (const flow of ['rows', 'columns'] as const) {
          const doc = seatingDoc(shape, 8, (d) => {
            d.design.paper = { ...d.design.paper, format: 'custom', width, height, orientation: 'portrait' }
            d.design.layout.flow = flow
          })
          const sheet = layoutSheet(doc, measure)
          expect(sheet.shape).toBe(shape)
          if (sheet.overflow) continue
          const outline = shapeOutline(shape, shapeBox(shape, width, height), doc.design.paper.margin - 0.5)
          for (const block of sheet.blocks) expect(boxInside(block, outline), `${shape} ${width}x${height} ${flow} ${block.type} ${block.id}`).toBe(true)
        }
  })

  it('places a sample seating board on one A4 page in every shape', () => {
    for (const shape of SHAPED) {
      const sheet = layoutSheet(seatingDoc(shape, 6), measure)
      expect(sheet.overflow, shape).toBe(false)
      expect(sheet.blocks.filter((block) => block.type === 'table')).toHaveLength(6)
    }
  })

  it('drops the title into an arch’s curve until it fits on its line', () => {
    // 48 characters, 96 mm: the arch (radius 90 inside the margin) is that wide 14 mm down.
    const sheet = layoutSheet(
      seatingDoc('arch', 6, (doc) => void (doc.content.heading = 'Welcome to the wedding of Aram and Ani Petrosyan')),
      measure
    )
    const header = sheet.blocks.find((block) => block.type === 'header')
    expect(header?.type === 'header' && header.heading).toHaveLength(1)
    expect(header!.y).toBeGreaterThan(sheet.area.y + 12)
    expect(header!.y).toBeLessThan(sheet.area.y + 18)
    expect(header!.x + header!.w / 2).toBeCloseTo(105, 0)
  })

  it('leaves place cards rectangular', () => {
    const doc = seatingDoc('oval')
    doc.design.kind = 'cards'
    expect(sheetShapeOf(doc.design)).toBe('rectangle')
    expect(layoutSheet(doc, measure).shape).toBe('rectangle')
  })

  it('lays out a rectangle as before', () => {
    const plain = layoutSheet(seatingDoc('rectangle'), measure)
    expect(plain.shape).toBe('rectangle')
    expect(plain.overflow).toBe(false)
    expect(plain.area).toEqual({ x: 15, y: 15, w: 180, h: 267 })
  })
})

describe('shapeArt', () => {
  it('draws the template’s frame along the outline, a double line as two', () => {
    const art = shapeArt('oval', 210, 297, TEMPLATE_FRAMES.ornament)
    expect(art.frame).toHaveLength(3)
    expect(art.face.x).toBeCloseTo(-1.5, 1)
    expect(art.clipPath.startsWith('polygon(')).toBe(true)
    expect(shapeArt('oval', 210, 297, undefined).frame).toEqual([])
  })
})
