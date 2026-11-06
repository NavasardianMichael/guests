import { describe, expect, it } from 'vitest'
import { isSafeReturnPath as isSafeOnWeb } from '@helpers/url'
import { buildWebUrl, isSafeReturnPath } from '../../../server/src/lib/return-path'

describe('isSafeReturnPath', () => {
  it.each(['/dashboard', '/editor/draft?checkout=1', '/templates/modern'])('accepts the same-site path %s', (path) => {
    expect(isSafeReturnPath(path)).toBe(true)
    expect(isSafeOnWeb(path)).toBe(true)
  })

  it.each(['//evil.example', '/\\evil.example', 'https://evil.example', 'dashboard', ''])('refuses %s (an open redirect)', (path) => {
    expect(isSafeReturnPath(path)).toBe(false)
    expect(isSafeOnWeb(path)).toBe(false)
  })

  it('refuses a header-splitting newline', () => {
    expect(isSafeReturnPath('/a\r\nSet-Cookie: x')).toBe(false)
  })
})

describe('buildWebUrl', () => {
  it('joins origin, path and query', () => {
    expect(buildWebUrl('https://guests-seating-board.eapps.site', '/payment/result', { status: 'succeeded', cv: 'c1' })).toBe(
      'https://guests-seating-board.eapps.site/payment/result?status=succeeded&cv=c1'
    )
  })
})
