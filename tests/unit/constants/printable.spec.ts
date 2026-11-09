import { describe, expect, it } from 'vitest'
import { processAccessResponse } from '@api/purchases/processors'
import { accessAfterPurchase, accessDaysLeft, isAccessActive, PASS_DAYS } from '@constants/pricing'
import { FREE_TEMPLATE_ID, isPrintable } from '@constants/templates'

const DAY = 24 * 60 * 60 * 1000
const NOW = Date.UTC(2026, 10, 9, 12)

describe('isPrintable', () => {
  it('prints the free template with or without a pass', () => {
    expect(isPrintable(FREE_TEMPLATE_ID, false)).toBe(true)
    expect(isPrintable(FREE_TEMPLATE_ID, true)).toBe(true)
  })

  it('prints a premium template only while a pass runs', () => {
    expect(isPrintable('ivory', false)).toBe(false)
    expect(isPrintable('ivory', true)).toBe(true)
  })
})

describe('access window helpers', () => {
  it('runs until its end, not at it', () => {
    expect(isAccessActive(null, NOW)).toBe(false)
    expect(isAccessActive(NOW + 1, NOW)).toBe(true)
    expect(isAccessActive(NOW, NOW)).toBe(false)
  })

  it('counts a started day as a day left', () => {
    expect(accessDaysLeft(NOW + PASS_DAYS * DAY, NOW)).toBe(PASS_DAYS)
    expect(accessDaysLeft(NOW + 2.1 * DAY, NOW)).toBe(3)
    expect(accessDaysLeft(NOW - DAY, NOW)).toBe(0)
    expect(accessDaysLeft(null, NOW)).toBe(0)
  })

  it('adds a new pass on top of a running one, else from now', () => {
    expect(accessAfterPurchase(null, NOW)).toBe(NOW + PASS_DAYS * DAY)
    expect(accessAfterPurchase(NOW - 5 * DAY, NOW)).toBe(NOW + PASS_DAYS * DAY)
    expect(accessAfterPurchase(NOW + 5 * DAY, NOW)).toBe(NOW + (5 + PASS_DAYS) * DAY)
  })
})

describe('processAccessResponse', () => {
  it('reads the end date and the payment status', () => {
    const until = new Date(NOW).toISOString()
    expect(processAccessResponse({ value: { accessUntil: until, payment: 'succeeded' }, error: null })).toEqual({ until: NOW, payment: 'succeeded' })
  })

  it('treats no date, or an unreadable one, as no access', () => {
    expect(processAccessResponse({ value: { accessUntil: null, payment: null }, error: null })).toEqual({ until: null, payment: null })
    expect(processAccessResponse({ value: { accessUntil: 'soon', payment: null }, error: null })).toEqual({ until: null, payment: null })
  })
})
