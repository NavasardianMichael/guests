import { describe, expect, it } from 'vitest'
import { processOwnedTemplatesResponse } from '@api/purchases/processors'
import { FREE_TEMPLATE_ID, isPrintable } from '@constants/templates'

describe('isPrintable', () => {
  it('prints the free template whatever is owned, even before that is known', () => {
    expect(isPrintable(FREE_TEMPLATE_ID, null)).toBe(true)
    expect(isPrintable(FREE_TEMPLATE_ID, [])).toBe(true)
  })

  it('prints a premium template only once its owner bought it', () => {
    expect(isPrintable('ivory', null)).toBe(false)
    expect(isPrintable('ivory', ['pastel'])).toBe(false)
    expect(isPrintable('ivory', ['pastel', 'ivory'])).toBe(true)
  })
})

describe('processOwnedTemplatesResponse', () => {
  it('drops ids this build does not know', () => {
    expect(processOwnedTemplatesResponse({ value: { templates: ['ivory', 'retired-template'] }, error: null })).toEqual(['ivory'])
  })
})
