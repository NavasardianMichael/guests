import { describe, expect, it } from 'vitest'
import type { ListDesign } from '@store/lists/single/types'
import { TEMPLATES } from '@constants/templates'
import { isAtDefault, RESET_SCOPES, resetDesign } from '@helpers/designReset'
import { templateDesign } from '@helpers/listFactory'
import { applyPaperPatch } from '@helpers/paperChange'

/** A seating board with every setting moved off its default. */
const tweaked = (): ListDesign => {
  const design = templateDesign('ornament', 'seating')
  applyPaperPatch(design, { format: 'A3', orientation: 'landscape', margin: 22 })
  design.palette.accent = '#123456'
  design.decor = false
  design.tableStyle = TEMPLATES.ornament.tableStyle === 'boxed' ? 'plain' : 'boxed'
  design.type.name.size = 30
  Object.assign(design.layout, { mode: 'free', columns: 5, gapX: 20, numbering: true, cardWidth: 120, sort: 'az' })
  design.layout.positions = { g1: { page: 0, x: 10, y: 10 } }
  design.layout.sizes = { g1: { w: 40, h: 10 } }
  return design
}

describe('resetDesign', () => {
  it('puts every scope back at the defaults, and resetting again changes nothing', () => {
    for (const scope of RESET_SCOPES) {
      const design = tweaked()
      expect(isAtDefault(design, scope), scope).toBe(false)
      expect(isAtDefault(resetDesign(design, scope), scope), scope).toBe(true)
    }
  })

  it('a fresh design has nothing to reset', () => {
    for (const scope of RESET_SCOPES) expect(isAtDefault(templateDesign('classic', 'list'), scope), scope).toBe(true)
  })

  it('all: the template’s design, keeping the kind and the template', () => {
    expect(resetDesign(tweaked(), 'all')).toEqual(templateDesign('ornament', 'seating'))
  })

  it('a section leaves the rest of its tab alone', () => {
    const design = tweaked()
    const next = resetDesign(design, 'layout.content')
    expect(next.layout.numbering).toBe(false)
    expect(next.layout.sort).toBe('manual')
    expect(next.layout.columns).toBe(5)
    expect(next.layout.positions).toEqual(design.layout.positions)
    expect(next.palette).toEqual(design.palette)
  })

  it('arrangement: back to the grid, nothing pinned or resized', () => {
    const next = resetDesign(tweaked(), 'layout.arrangement')
    expect(next.layout).toMatchObject({ mode: 'grid', positions: {}, sizes: {}, columns: 5 })
  })

  it('paper size: A4 portrait, letters and dragged blocks scaled back with it', () => {
    const design = tweaked()
    const next = resetDesign(design, 'paper.format')
    expect(next.paper).toMatchObject({ format: 'A4', width: 210, height: 297, orientation: 'portrait', margin: 22 })
    expect(next.textScale).toBe(1)
    expect(next.layout.positions.g1.x).toBeLessThan(design.layout.positions.g1.x)
  })

  it('typography keeps the paper’s letter size', () => {
    const next = resetDesign(tweaked(), 'design.typography')
    expect(next.type).toEqual(templateDesign('ornament', 'seating').type)
    expect(next.textScale).toBe(1.41)
  })

  it('leaves the given design untouched', () => {
    const design = tweaked()
    const copy = structuredClone(design)
    resetDesign(design, 'all')
    expect(design).toEqual(copy)
  })
})
