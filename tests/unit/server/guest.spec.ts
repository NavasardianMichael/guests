import { describe, expect, it } from 'vitest'
import { ensureGuestKeyHash, GUEST_COOKIE, readGuestKeyHash } from '../../../server/src/lib/guest'
import { hashUrlToken } from '../../../server/src/lib/token'

/** Express's types belong to the server package; the functions say what they take. */
type Request = Parameters<typeof readGuestKeyHash>[0]
type Response = Parameters<typeof ensureGuestKeyHash>[1]

const requestWith = (key?: string): Request => ({ cookies: key === undefined ? {} : { [GUEST_COOKIE]: key } }) as unknown as Request

/** Records the cookies a handler sets. */
const recordingResponse = () => {
  const set: { name: string; value: string; options: Record<string, unknown> }[] = []
  const res = {
    cookie: (name: string, value: string, options: Record<string, unknown>) => {
      set.push({ name, value, options })
      return res
    },
  }
  return { res: res as unknown as Response, set }
}

const KEY = 'a1'.repeat(32)

describe('guest key', () => {
  it('is stored hashed, never as the key itself', () => {
    expect(readGuestKeyHash(requestWith(KEY))).toBe(hashUrlToken(KEY))
    expect(readGuestKeyHash(requestWith(KEY))).not.toBe(KEY)
  })

  it('ignores a missing or malformed cookie rather than trusting it', () => {
    expect(readGuestKeyHash(requestWith())).toBeNull()
    expect(readGuestKeyHash(requestWith('short'))).toBeNull()
    expect(readGuestKeyHash(requestWith('Z'.repeat(64)))).toBeNull()
    expect(readGuestKeyHash(requestWith(`${KEY}0`))).toBeNull()
  })

  it('is minted once, as an httpOnly cookie, and reused after that', () => {
    const first = recordingResponse()
    const minted = ensureGuestKeyHash(requestWith(), first.res)
    expect(first.set).toHaveLength(1)
    expect(first.set[0].name).toBe(GUEST_COOKIE)
    expect(first.set[0].value).toMatch(/^[0-9a-f]{64}$/)
    expect(first.set[0].options.httpOnly).toBe(true)
    expect(minted).toBe(hashUrlToken(first.set[0].value))

    const again = recordingResponse()
    expect(ensureGuestKeyHash(requestWith(first.set[0].value), again.res)).toBe(minted)
    expect(again.set[0].value).toBe(first.set[0].value)
  })
})
