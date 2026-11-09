import { describe, expect, it } from 'vitest'
import { coerceContent, coerceDesign, coerceTitle, LIST_LIMITS } from '../../../server/src/services/listDocument'

describe('coerceContent', () => {
  it('keeps a valid list as it is', () => {
    const content = {
      heading: 'Բարի գալուստ',
      subheading: '',
      footer: '',
      tables: [{ id: 't1', name: 'Սեղան 1', shape: 'rect', seats: 8 }],
      guests: [{ id: 'g1', name: 'Արամ', tableId: 't1', note: '+1' }],
      venue: [{ id: 'v1', kind: 'stage', label: 'Բեմ' }],
    }
    expect(coerceContent(content)).toEqual(content)
  })

  it('gives a table saved before the hall plan a round shape and a chair per guest, and the list an empty hall', () => {
    const content = coerceContent({ tables: [{ id: 't1', name: 'Սեղան 1' }], guests: [] })
    expect(content.tables).toEqual([{ id: 't1', name: 'Սեղան 1', shape: 'round', seats: 0 }])
    expect(content.venue).toEqual([])
  })

  it('keeps the hall plan within the catalogue and the limits', () => {
    const content = coerceContent({
      tables: [{ id: 't1', name: 'T', shape: 'oval', seats: 999 }],
      venue: [
        { id: 't1', kind: 'pool', label: 'x'.repeat(500) },
        ...Array.from({ length: LIST_LIMITS.venue + 5 }, () => ({ kind: 'entrance', label: 'Մուտք' })),
      ],
    })
    expect(content.tables[0]).toMatchObject({ shape: 'round', seats: LIST_LIMITS.seats })
    expect(content.venue).toHaveLength(LIST_LIMITS.venue)
    // An id a table already has is not reused: the plan keys both by id.
    expect(content.venue[0]).toMatchObject({ kind: 'stage', label: 'x'.repeat(LIST_LIMITS.venueLabel) })
    expect(content.venue[0].id).not.toBe('t1')
  })

  it('unseats a guest whose table does not exist and replaces bad or repeated ids', () => {
    const content = coerceContent({
      tables: [],
      guests: [
        { id: 'same', name: 'A', tableId: 'gone' },
        { id: 'same', name: 'B' },
        { id: 'not an id!', name: 'C' },
      ],
    })
    expect(content.guests.map((guest) => guest.tableId)).toEqual(['', '', ''])
    expect(new Set(content.guests.map((guest) => guest.id)).size).toBe(3)
    expect(content.guests[0].id).toBe('same')
    expect(content.guests[2].id).toMatch(/^[a-z0-9]+$/)
  })

  it('caps the number of guests and the length of a name', () => {
    const content = coerceContent({ guests: Array.from({ length: LIST_LIMITS.guests + 5 }, () => ({ name: 'x'.repeat(500) })) })
    expect(content.guests).toHaveLength(LIST_LIMITS.guests)
    expect(content.guests[0].name).toHaveLength(LIST_LIMITS.name)
  })

  it('answers an empty list for garbage', () => {
    expect(coerceContent('nope')).toEqual({ heading: '', subheading: '', footer: '', guests: [], tables: [], venue: [] })
  })
})

describe('coerceDesign', () => {
  it('drops what is not in the catalogue and clamps numbers', () => {
    const design = coerceDesign({
      templateId: 'nope',
      kind: 'poster',
      paper: { format: 'custom', width: 5, height: 99999, margin: -3 },
      palette: { background: 'red', accent: '#ABCDEF' },
      type: { name: { font: 'comic-sans', size: 400, color: '#123456' } },
      layout: { columns: 40, positions: { ok: { page: 1, x: 10, y: 20 }, 'bad id!': { page: 0, x: 0, y: 0 } } },
    })
    expect(design.templateId).toBe('memorial')
    expect(design.kind).toBe('seating')
    expect(design.paper).toMatchObject({ width: 50, height: 1189, margin: 0 })
    expect(design.palette).toMatchObject({ background: '#ffffff', accent: '#abcdef' })
    expect(design.type.name).toMatchObject({ font: 'ghea-grapalat', size: 120, color: '#123456' })
    expect(design.layout.columns).toBe(12)
    expect(design.layout.positions).toEqual({ ok: { page: 1, x: 10, y: 20 } })
  })

  it('keeps resized blocks within the size limits, and lists saved before resizing get none', () => {
    const design = coerceDesign({
      layout: { sizes: { ok: { w: 60, h: 25 }, tiny: { w: 1, h: -5 }, 'bad id!': { w: 50, h: 50 }, junk: 'x' } },
    })
    expect(design.layout.sizes).toEqual({ ok: { w: 60, h: 25 }, tiny: { w: 10, h: 4 } })
    expect(coerceDesign({ layout: {} }).layout.sizes).toEqual({})
  })

  it('keeps the hall plan apart from the layout, and gives a list saved before it an empty one', () => {
    const design = coerceDesign({
      kind: 'plan',
      plan: { positions: { t1: { page: 0, x: 40, y: 60 }, 'bad id!': { page: 0, x: 0, y: 0 } }, sizes: { t1: { w: 50, h: 50 } } },
    })
    expect(design.kind).toBe('plan')
    expect(design.plan).toEqual({ arrangement: 'rows', positions: { t1: { page: 0, x: 40, y: 60 } }, sizes: { t1: { w: 50, h: 50 } } })
    expect(coerceDesign({ kind: 'plan', plan: { arrangement: 'sides' } }).plan.arrangement).toBe('sides')
    expect(coerceDesign({ kind: 'plan', plan: { arrangement: 'spiral' } }).plan.arrangement).toBe('rows')
    expect(design.layout.positions).toEqual({})
    expect(coerceDesign({}).plan).toEqual({ arrangement: 'rows', positions: {}, sizes: {} })
  })

  it('takes a named paper size from the catalogue, whatever was sent', () => {
    expect(coerceDesign({ paper: { format: 'A3', width: 1, height: 1 } }).paper).toMatchObject({ width: 297, height: 420 })
  })

  it('keeps a list saved on the dropped Legal format at its size, as a custom one', () => {
    const paper = coerceDesign({ paper: { format: 'legal', width: 215.9, height: 355.6, orientation: 'landscape' } }).paper
    expect(paper).toMatchObject({ format: 'custom', width: 215.9, height: 355.6, orientation: 'landscape' })
  })
})

describe('coerceTitle', () => {
  it('falls back for an empty title', () => {
    expect(coerceTitle('   ', 'Fallback')).toBe('Fallback')
    expect(coerceTitle('Հարսանիք', 'Fallback')).toBe('Հարսանիք')
  })
})
