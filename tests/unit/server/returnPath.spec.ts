import { describe, expect, it } from 'vitest'
import { safeReturnPath as onWeb } from '@helpers/url'
import { buildWebUrl, safeReturnPath as onServer } from '../../../server/src/lib/return-path'

const ORIGIN = 'https://guests-seating-board.eapps.site'

describe.each([
  ['server', onServer],
  ['web', onWeb],
])('safeReturnPath (%s)', (_, safeReturnPath) => {
  it.each(['/', '/dashboard', '/editor/draft?checkout=1', '/templates/modern#top', '/editor/%D5%A1'])('keeps the same-site path %j as it is', (path) => {
    expect(safeReturnPath(path)).toBe(path)
  })

  it.each([
    ['/dash\tboard', '/dashboard'],
    ['/dash\nboard', '/dashboard'],
    ['/editor\\draft', '/editor/draft'],
    ['/my lists', '/my%20lists'],
    ['dashboard', '/dashboard'],
    ['/.//evil.example', '/evil.example'],
  ])('cleans %j into %j instead of refusing it', (input, cleaned) => {
    expect(safeReturnPath(input)).toBe(cleaned)
  })

  it.each([
    'https://evil.example',
    '//evil.example',
    '/\\evil.example',
    '\\\\evil.example',
    '/\t/evil.example',
    '/\n/evil.example',
    '/\r/evil.example',
    ' //evil.example',
    'javascript:alert(1)',
    `/${'a'.repeat(512)}`,
    42,
    undefined,
  ])('refuses %j, which would leave the site', (value) => {
    expect(safeReturnPath(value)).toBeUndefined()
  })

  it('never keeps a header-splitting newline', () => {
    expect(safeReturnPath('/a\r\nSet-Cookie: x')).not.toMatch(/[\r\n]/)
  })

  // Whatever it returns must stay on our origin when a browser resolves it.
  it('never returns a path that resolves off-site', () => {
    const probes = ['/\t/evil.example', '/\\/evil.example', '/%2F/evil.example', '/.//evil.example', '/x/../\t/evil.example', '/./\\evil.example', '/\u0000/x', '/x?\t//y#\\z']
    for (const probe of probes) {
      const path = safeReturnPath(probe)
      if (path === undefined) continue
      expect(path).toMatch(/^\/(?!\/)/)
      expect(new URL(path, ORIGIN).origin).toBe(ORIGIN)
    }
  })
})

describe('buildWebUrl', () => {
  it('joins origin, path and query', () => {
    expect(buildWebUrl('https://guests-seating-board.eapps.site', '/payment/result', { status: 'succeeded', template: 'ivory' })).toBe(
      'https://guests-seating-board.eapps.site/payment/result?status=succeeded&template=ivory'
    )
  })
})
