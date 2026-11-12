import { describe, expect, it } from 'vitest'
import { type PassWindow, PHOTO_READS_PER_PASS, photoStatus } from '../../../server/src/services/photoQuota'

const DAY = 24 * 60 * 60 * 1000
const T0 = Date.UTC(2026, 10, 1)
const window = (passes: number): PassWindow => ({ startedAt: new Date(T0), until: new Date(T0 + passes * 21 * DAY), passes })

describe('photoStatus', () => {
  it('is locked without a running pass', () => {
    expect(photoStatus(null, 0)).toEqual({ state: 'locked', allowance: 0, remaining: 0, until: null })
  })

  it('gives each pass five reads, counted over the running window', () => {
    expect(PHOTO_READS_PER_PASS).toBe(5)
    expect(photoStatus(window(1), 0)).toMatchObject({ state: 'available', allowance: 5, remaining: 5 })
    expect(photoStatus(window(1), 4)).toMatchObject({ state: 'available', remaining: 1 })
  })

  it('is used once every read is spent, and says until when access runs', () => {
    expect(photoStatus(window(1), 5)).toEqual({ state: 'used', allowance: 5, remaining: 0, until: new Date(T0 + 21 * DAY) })
    expect(photoStatus(window(1), 7).remaining).toBe(0)
  })

  it('adds the reads of days bought on top of a running pass', () => {
    expect(photoStatus(window(2), 5)).toMatchObject({ state: 'available', allowance: 10, remaining: 5 })
  })
})
