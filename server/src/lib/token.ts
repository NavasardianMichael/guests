import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'

/**
 * Single-use tokens that travel in a URL (password reset). Stored hashed, so a database
 * read alone cannot be turned into a working link.
 */
export const mintUrlToken = (): string => randomBytes(32).toString('hex')

export const hashUrlToken = (token: string): string => createHash('sha256').update(token).digest('hex')

export const urlTokensMatch = (token: string, storedHash: string): boolean => {
  const actual = Buffer.from(hashUrlToken(token))
  const expected = Buffer.from(storedHash)
  if (actual.length !== expected.length) return false
  return timingSafeEqual(actual, expected)
}
