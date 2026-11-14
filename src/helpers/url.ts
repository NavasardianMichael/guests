import { API_URL_FALLBACK, SITE_URL_FALLBACK } from '@constants/app'

/** The site's own origin: canonicals, sitemap and every JSON-LD `@id` build on it. */
export const getSiteUrl = (): string => (process.env.NEXT_PUBLIC_SITE_URL || SITE_URL_FALLBACK).replace(/\/+$/, '')

export const absoluteUrl = (path: string): string => `${getSiteUrl()}${path.startsWith('/') ? path : `/${path}`}`

export const getApiUrl = (): string => (process.env.NEXT_PUBLIC_API_URL || API_URL_FALLBACK).replace(/\/+$/, '')

const RETURN_BASE = 'https://return-path.invalid'

/**
 * The post-sign-in destination as a clean same-site path, or `undefined` when it would leave the
 * site. Same rule as the API's `safeReturnPath` (`server/src/lib/return-path.ts`): resolved as a
 * browser would, so a hidden tab or `\` cannot turn it into another host, and a path that merely
 * carries them is kept, cleaned.
 */
export const safeReturnPath = (value: unknown): string | undefined => {
  if (typeof value !== 'string' || value.length > 512) return undefined
  let url: URL
  try {
    url = new URL(value, RETURN_BASE)
  } catch {
    return undefined
  }
  if (url.origin !== RETURN_BASE) return undefined
  // `/.//evil.example` normalises to the path `//evil.example`, which a redirect would read as a host.
  return `/${url.pathname.replace(/^\/+/, '')}${url.search}${url.hash}`
}
