import { runInNewContext } from 'node:vm'
import { describe, expect, it } from 'vitest'
import { asksForConsent, consentDefaultsScript } from '@helpers/consent'

const KEY = 'guests:analytics-consent:v1'

/** Runs the inline <head> script for a device in `timeZone` and returns its analytics default. */
const headDefault = (timeZone: string | undefined, stored: string | null = null): string => {
  const context: Record<string, unknown> = {
    Intl: { DateTimeFormat: () => ({ resolvedOptions: () => ({ timeZone }) }) },
    localStorage: { getItem: (key: string) => (key === KEY ? stored : null) },
  }
  context.window = context
  runInNewContext(consentDefaultsScript(), context)
  const [[command, kind, values]] = context.dataLayer as [string, string, Record<string, string>][]
  expect([command, kind]).toEqual(['consent', 'default'])
  expect(values.ad_storage).toBe('denied')
  return values.analytics_storage
}

const ZONES = ['Europe/Berlin', 'Europe/London', 'Europe/Zurich', 'Atlantic/Canary', 'Asia/Nicosia', 'Europe/Oslo', 'Asia/Yerevan', 'Europe/Moscow', 'America/Los_Angeles', 'UTC', 'Etc/GMT+3', undefined]

describe('analytics consent by region', () => {
  it('asks in the EU, EEA, UK and Switzerland, and where the zone is unknown', () => {
    for (const zone of ['Europe/Berlin', 'Europe/Paris', 'Europe/London', 'Europe/Zurich', 'Atlantic/Canary', 'Asia/Nicosia', 'Europe/Oslo', 'UTC', 'Etc/GMT+3', undefined, '']) {
      expect(asksForConsent(zone), String(zone)).toBe(true)
    }
  })

  it('does not ask elsewhere, Armenia and its diaspora included', () => {
    for (const zone of ['Asia/Yerevan', 'Europe/Moscow', 'Asia/Tbilisi', 'America/Los_Angeles', 'America/New_York', 'Asia/Dubai']) {
      expect(asksForConsent(zone), zone).toBe(false)
    }
  })

  it('the <head> default matches the banner: denied where it asks, granted elsewhere', () => {
    for (const zone of ZONES) {
      expect(headDefault(zone), String(zone)).toBe(asksForConsent(zone) ? 'denied' : 'granted')
    }
  })

  it('a stored answer wins over the region', () => {
    expect(headDefault('Europe/Berlin', 'granted')).toBe('granted')
    expect(headDefault('Asia/Yerevan', 'denied')).toBe('denied')
  })
})
