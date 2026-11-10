import { describe, expect, it } from 'vitest'
import { formatDate } from '@helpers/date'

describe('formatDate', () => {
  it('writes Armenian dates with Armenian month names, whatever the runtime knows of `hy`', () => {
    expect(formatDate('2026-11-30T09:17:44Z', 'hy')).toBe('30 նոյեմբերի 2026 թ.')
  })

  it('adds the time on a 24-hour clock, in Yerevan time', () => {
    expect(formatDate('2026-10-31T15:42:00Z', 'hy', { time: true })).toBe('31 հոկտեմբերի 2026 թ., 19:42')
  })

  it('pads the hour and minute, not the day, and moves the day with Yerevan time', () => {
    expect(formatDate('2026-01-04T20:05:00Z', 'hy', { time: true })).toBe('5 հունվարի 2026 թ., 00:05')
  })

  it('writes Russian and English dates in their own words', () => {
    expect(formatDate('2026-11-30T09:17:44Z', 'ru')).toBe('30 ноября 2026 г.')
    expect(formatDate('2026-11-30T09:17:44Z', 'en')).toBe('November 30, 2026')
  })
})
