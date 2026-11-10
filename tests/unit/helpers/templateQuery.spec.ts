import { describe, expect, it } from 'vitest'
import { templatePath, templatesPath } from '@constants/routes'
import { previewDocument, type SampleTexts } from '@helpers/listFactory'
import { viewFromQuery } from '@helpers/templateQuery'

const texts: SampleTexts = {
  heading: 'Welcome',
  subheading: 'Aram and Ani',
  footer: 'Thank you',
  table: (number) => `Table ${number}`,
  venue: { stage: 'Stage', dancefloor: 'Dance floor', entrance: 'Entrance' },
}

describe('viewFromQuery', () => {
  it('defaults to a seating board in rows', () => {
    expect(viewFromQuery({})).toEqual({ kind: 'seating', arrangement: 'rows' })
    expect(viewFromQuery({ kind: 'nope', arrangement: 'spiral' })).toEqual({ kind: 'seating', arrangement: 'rows' })
  })

  it('reads a repeated query the way a URL parser hands the page its first value', () => {
    expect(viewFromQuery({ kind: ['plan', 'cards'], arrangement: ['around', 'rows'] })).toEqual({
      kind: 'plan',
      arrangement: 'around',
    })
  })
})

describe('templatePath', () => {
  it('opens the template on the kind it was picked from, and keeps a hall arrangement', () => {
    expect(templatePath('ivory')).toBe('/templates/ivory')
    expect(templatePath('ivory', { kind: 'seating' })).toBe('/templates/ivory')
    expect(templatePath('pomegranate', { kind: 'list' })).toBe('/templates/pomegranate?kind=list')
    expect(templatePath('velvet', { kind: 'cards' })).toBe('/templates/velvet?kind=cards')
    expect(templatePath('carpet', { kind: 'plan' })).toBe('/templates/carpet?kind=plan')
    expect(templatePath('emerald', { kind: 'plan', arrangement: 'around' })).toBe('/templates/emerald?kind=plan&arrangement=around')
    expect(templatePath('emerald', { kind: 'plan', arrangement: 'rows' })).toBe('/templates/emerald?kind=plan')
  })
})

describe('templatesPath', () => {
  it('leaves the defaults off the URL and keeps an arrangement only on the hall plan', () => {
    expect(templatesPath()).toBe('/templates')
    expect(templatesPath({ kind: 'seating', arrangement: 'around' })).toBe('/templates')
    expect(templatesPath({ kind: 'plan' })).toBe('/templates?kind=plan')
    expect(templatesPath({ kind: 'plan', arrangement: 'rows' })).toBe('/templates?kind=plan')
    expect(templatesPath({ kind: 'plan', arrangement: 'around' })).toBe('/templates?kind=plan&arrangement=around')
    expect(templatesPath({ kind: 'cards', arrangement: 'banquet' })).toBe('/templates?kind=cards')
  })
})

describe('previewDocument', () => {
  it('sets a hall out by the arrangement asked for', () => {
    const around = previewDocument(texts, 'carpet', 'plan', 'around')
    const banquet = previewDocument(texts, 'carpet', 'plan', 'banquet')
    const rows = previewDocument(texts, 'carpet', 'plan', 'rows')
    expect(around.design.kind).toBe('plan')
    expect(around.design.plan.arrangement).toBe('around')
    expect(around.content.tables.every((table) => table.shape === 'round')).toBe(true)
    expect(banquet.content.tables.every((table) => table.shape === 'rect')).toBe(true)
    expect(rows.design.plan.arrangement).toBe('rows')
    expect(rows.content.tables.every((table) => table.shape === 'round')).toBe(true)
    expect(around.design.plan.positions).toEqual({})
  })

  it('prints a few whole place cards and leaves other kinds unarranged', () => {
    expect(previewDocument(texts, 'memorial', 'cards').content.tables).toHaveLength(3)
    expect(previewDocument(texts, 'memorial', 'seating').design.kind).toBe('seating')
    expect(previewDocument(texts, 'memorial', 'list', 'banquet').design.plan.arrangement).toBe('rows')
  })
})
