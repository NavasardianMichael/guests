import { describe, expect, it } from 'vitest'
import { FREE_TEMPLATE_IDS } from '../../../server/src/lib/catalogue'
import { accessWindow, printTerms } from '../../../server/src/services/entitlement'
import { RETENTION_DAYS, retentionCutoff } from '../../../server/src/services/retention'

const DAY = 24 * 60 * 60 * 1000
const T0 = Date.UTC(2026, 10, 1)
const paid = (id: string, day: number) => ({ id, paidAt: new Date(T0 + day * DAY) })

describe('printTerms', () => {
  it('prints everything clean while a pass runs', () => {
    expect(printTerms({ templateId: 'ivory', active: true })).toEqual({ allowed: true, watermark: false })
    expect(printTerms({ templateId: FREE_TEMPLATE_IDS[0], active: true })).toEqual({ allowed: true, watermark: false })
  })

  it('without one, prints only the free template, with the "made with" line', () => {
    expect(printTerms({ templateId: FREE_TEMPLATE_IDS[0], active: false })).toEqual({ allowed: true, watermark: true })
    expect(printTerms({ templateId: 'ivory', active: false })).toEqual({ allowed: false, watermark: true })
  })
})

describe('accessWindow', () => {
  it('is empty with no payment', () => {
    expect(accessWindow([], 21)).toEqual({ until: null, chain: [] })
  })

  it('runs the pass days from the payment', () => {
    const window = accessWindow([paid('a', 0)], 21)
    expect(window.until).toEqual(new Date(T0 + 21 * DAY))
    expect(window.chain.map((p) => p.id)).toEqual(['a'])
  })

  it('adds a pass bought while one runs on top, whatever order the rows come in', () => {
    const window = accessWindow([paid('b', 10), paid('a', 0)], 21)
    expect(window.until).toEqual(new Date(T0 + 42 * DAY))
    expect(window.chain.map((p) => p.id)).toEqual(['a', 'b'])
  })

  it('starts a new window after a gap, leaving the old payments out of it', () => {
    const window = accessWindow([paid('a', 0), paid('b', 30)], 21)
    expect(window.until).toEqual(new Date(T0 + 51 * DAY))
    expect(window.chain.map((p) => p.id)).toEqual(['b'])
  })

  it('counts a payment made the moment the last one ends as a new window', () => {
    const window = accessWindow([paid('a', 0), paid('b', 21)], 21)
    expect(window.until).toEqual(new Date(T0 + 42 * DAY))
    expect(window.chain.map((p) => p.id)).toEqual(['b'])
  })
})

describe('retentionCutoff', () => {
  it('is a year back', () => {
    expect(RETENTION_DAYS).toBe(365)
    expect(retentionCutoff(new Date(T0))).toEqual(new Date(T0 - 365 * DAY))
  })
})
