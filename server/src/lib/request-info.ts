import type { Request } from 'express'

/**
 * Who is behind a request, as far as the request says: for the internal payment mails
 * (`services/paymentNotifications.ts`), never for a decision. Every value is client-supplied
 * and unverified — bounded here, sanitised by the mail engine, and never trusted.
 */

/**
 * What the browser reports about itself, sent with a checkout (`src/helpers/clientInfo.ts`,
 * the web twin of these keys). Anything else in the body is dropped.
 */
const CLIENT_KEYS = [
  'timezone',
  'languages',
  'platform',
  'mobile',
  'screen',
  'viewport',
  'pixelRatio',
  'touchPoints',
  'cores',
  'memoryGb',
  'connection',
  'colorScheme',
  'standalone',
] as const

export type ClientInfoKey = (typeof CLIENT_KEYS)[number]
export type ClientInfo = Partial<Record<ClientInfoKey, string>>

const MAX_CLIENT_VALUE = 100
const MAX_USER_AGENT = 500
const MAX_HEADER = 300

const bounded = (value: string | undefined, max: number): string | null => {
  const trimmed = value?.trim()
  return trimmed ? trimmed.slice(0, max) : null
}

/** Whitelisted keys; strings, finite numbers and booleans only, each a short string. */
export const asClientInfo = (raw: unknown): ClientInfo => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const source = raw as Record<string, unknown>
  const info: ClientInfo = {}
  for (const key of CLIENT_KEYS) {
    const value = source[key]
    let text: string | null = null
    if (typeof value === 'string') text = bounded(value, MAX_CLIENT_VALUE)
    else if (typeof value === 'number' && Number.isFinite(value)) text = String(value)
    else if (typeof value === 'boolean') text = value ? 'yes' : 'no'
    if (text) info[key] = text
  }
  return info
}

export type RequestInfo = {
  ip: string | null
  userAgent: string | null
  acceptLanguage: string | null
  /** Chromium's low-entropy client hints, summarised: brand, platform, mobile. */
  clientHints: string | null
  referer: string | null
  client: ClientInfo
}

/** `"Google Chrome";v="130", "Not?A_Brand";v="99"` → `Google Chrome 130`, the decoy brand dropped. */
const describeBrands = (header: string | undefined): string | null => {
  if (!header) return null
  const brands = [...header.matchAll(/"([^"]+)";\s*v="([^"]+)"/g)]
    .filter(([, brand]) => !/not.?a.?brand/i.test(brand))
    .map(([, brand, version]) => `${brand} ${version}`)
  const named = brands.find((brand) => !brand.startsWith('Chromium')) ?? brands[0]
  return named ?? null
}

const unquote = (value: string | undefined): string | undefined => value?.replace(/^"|"$/g, '')

const readClientHints = (req: Request): string | null => {
  const parts = [
    describeBrands(req.get('sec-ch-ua')),
    unquote(req.get('sec-ch-ua-platform')),
    { '?1': 'mobile', '?0': 'not mobile' }[req.get('sec-ch-ua-mobile') ?? ''],
  ].filter(Boolean)
  return parts.length ? bounded(parts.join(' · '), MAX_HEADER) : null
}

/** `req.ip` is the real client behind nginx (`trust proxy` in `app.ts`). */
export const readRequestInfo = (req: Request): RequestInfo => ({
  ip: req.ip ?? null,
  userAgent: bounded(req.get('user-agent'), MAX_USER_AGENT),
  acceptLanguage: bounded(req.get('accept-language'), MAX_HEADER),
  clientHints: readClientHints(req),
  referer: bounded(req.get('referer'), MAX_HEADER),
  client: asClientInfo((req.body as Record<string, unknown> | undefined)?.client),
})

const BROWSERS: [RegExp, string][] = [
  [/FBA[NV]\/|FB_IAB/, 'Facebook in-app'],
  [/Instagram/, 'Instagram in-app'],
  [/Edg(?:e|A|iOS)?\/(\d+)/, 'Edge'],
  [/OPR\/(\d+)|Opera/, 'Opera'],
  [/SamsungBrowser\/(\d+)/, 'Samsung Internet'],
  [/YaBrowser\/(\d+)/, 'Yandex Browser'],
  [/FxiOS\/(\d+)/, 'Firefox'],
  [/CriOS\/(\d+)/, 'Chrome'],
  [/Firefox\/(\d+)/, 'Firefox'],
  [/Chrome\/(\d+)/, 'Chrome'],
  [/Version\/([\d.]+).*Safari\//, 'Safari'],
]

const OPERATING_SYSTEMS: [RegExp, (match: RegExpMatchArray) => string][] = [
  [/Windows NT 10/, () => 'Windows 10/11'],
  [/Windows/, () => 'Windows'],
  [/Android ([\d.]+)/, (m) => `Android ${m[1]}`],
  [/iPad.*? OS (\d+)_(\d+)/, (m) => `iPadOS ${m[1]}.${m[2]}`],
  [/iPhone OS (\d+)_(\d+)/, (m) => `iOS ${m[1]}.${m[2]}`],
  [/CrOS/, () => 'ChromeOS'],
  [/Mac OS X/, () => 'macOS'],
  [/Linux/, () => 'Linux'],
]

/**
 * `Chrome 130 · Android 14 · mobile` — a reader's summary of a user agent, not a parser to
 * branch on. An iPad in desktop mode says "macOS"; the browser's touch points tell it apart.
 */
export const describeUserAgent = (userAgent: string | null): string => {
  if (!userAgent) return 'unknown'
  const browser = BROWSERS.reduce<string | null>((found, [pattern, name]) => {
    if (found) return found
    const match = userAgent.match(pattern)
    return match ? (match[1] ? `${name} ${match[1]}` : name) : null
  }, null)
  const os = OPERATING_SYSTEMS.reduce<string | null>((found, [pattern, name]) => {
    if (found) return found
    const match = userAgent.match(pattern)
    return match ? name(match) : null
  }, null)
  const device =
    /iPad|Tablet/i.test(userAgent) || (/Android/.test(userAgent) && !/Mobile/.test(userAgent))
      ? 'tablet'
      : /Mobi|iPhone|iPod/.test(userAgent)
        ? 'mobile'
        : 'desktop'
  return [browser ?? 'unknown browser', os ?? 'unknown OS', device].join(' · ')
}
