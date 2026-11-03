import { API_URL_FALLBACK, SITE_URL_FALLBACK } from '@constants/app'

/** The site's own origin: canonicals, sitemap and every JSON-LD `@id` build on it. */
export const getSiteUrl = (): string => (process.env.NEXT_PUBLIC_SITE_URL || SITE_URL_FALLBACK).replace(/\/+$/, '')

export const absoluteUrl = (path: string): string => `${getSiteUrl()}${path.startsWith('/') ? path : `/${path}`}`

export const getApiUrl = (): string => (process.env.NEXT_PUBLIC_API_URL || API_URL_FALLBACK).replace(/\/+$/, '')

/** Same-site paths only — the client-side twin of the API's `isSafeReturnPath`. */
export const isSafeReturnPath = (value: unknown): value is string =>
  typeof value === 'string' && value.startsWith('/') && !value.startsWith('//') && !value.startsWith('/\\')

/** A link for a CV's website/LinkedIn line, or undefined when it does not parse as http(s). */
export const toWebsiteUrl = (text: string | undefined): string | undefined => {
  const trimmed = text?.trim()
  if (!trimmed) return undefined
  const withScheme = /^[a-z][a-z\d+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`
  try {
    const url = new URL(withScheme)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return undefined
    if (!url.hostname.includes('.')) return undefined
    return url.href
  } catch {
    return undefined
  }
}
