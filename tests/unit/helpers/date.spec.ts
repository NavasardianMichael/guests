import { describe, expect, it } from 'vitest'
import { formatDateTime } from '@helpers/date'

describe('formatDateTime', () => {
  it('writes the month in Armenian and the time on a 24-hour clock, in Yerevan time', () => {
    expect(formatDateTime('2026-10-31T15:42:00Z')).toBe('31 հոկտեմբերի 2026 թ., 19:42')
  })

  it('pads the hour and minute, not the day', () => {
    expect(formatDateTime('2026-01-04T20:05:00Z')).toBe('5 հունվարի 2026 թ., 00:05')
  })
})
