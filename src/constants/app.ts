import { FONT_SLUGS } from './fonts'
import { TEMPLATE_IDS } from './templates'

/** Brand and site-wide facts. */
export const APP_NAME = 'Իմ հյուրերը'
export const APP_NAME_LATIN = 'Guests'

/** The one-line pitch (Armenian): llms.txt, JSON-LD. Pages take theirs from `Meta.*` in their language. */
export const APP_TAGLINE = 'Հյուրերի ցուցակ և նստատեղերի ցուցանակ տպելու համար'

export const APP_DESCRIPTION =
  'Կազմեք հյուրերի ցուցակը մի քանի րոպեում՝ ներմուծեք Excel-ից, CSV-ից կամ լուսանկարից, դասավորեք սեղաններով և տպեք' +
  ` նստատեղերի ցուցանակ, հյուրերի ցուցակ կամ անվանաքարտեր՝ ${TEMPLATE_IDS.length} դասական և ստեղծագործական ձևանմուշով,` +
  ` ${FONT_SLUGS.length} հայերեն տառատեսակով, ցանկացած չափի թղթի վրա։`

/** The public domain, as printed in the free PDF's watermark (which links to it). */
export const SITE_DOMAIN = 'guests.eapps.site'

/** `NEXT_PUBLIC_SITE_URL` when unset (local dev). */
export const SITE_URL_FALLBACK = 'http://localhost:7010'

export const API_URL_FALLBACK = 'http://localhost:9010'

export const API_REQUEST_TIMEOUT_MS = 30_000
/** Rendering a PDF in headless Chrome can take a while on a cold browser. */
export const API_PDF_TIMEOUT_MS = 90_000
/** Reading a photographed list takes the model several seconds, a long one more. */
export const API_AI_TIMEOUT_MS = 120_000

/**
 * The interface's languages. Armenian is the product's language and the default; Russian and
 * English are there for whoever prefers them. The choice is a cookie, not a URL segment
 * (`src/i18n/request.ts`): one set of pages, indexed in Armenian.
 */
export const LOCALES = ['hy', 'ru', 'en'] as const
export type Locale = (typeof LOCALES)[number]
export const DEFAULT_LOCALE: Locale = 'hy'
export const LOCALE_COOKIE = 'NEXT_LOCALE'
export const isLocale = (value: unknown): value is Locale =>
  typeof value === 'string' && (LOCALES as readonly string[]).includes(value)

/** Each language in its own words, for the switcher. */
export const LOCALE_NAMES: Record<Locale, string> = { hy: 'Հայերեն', ru: 'Русский', en: 'English' }
export const OG_LOCALES: Record<Locale, string> = { hy: 'hy_AM', ru: 'ru_RU', en: 'en_US' }

/** The default language's, for metadata that is not per request. */
export const LOCALE = DEFAULT_LOCALE
export const OG_LOCALE = OG_LOCALES[DEFAULT_LOCALE]
/** Dates are shown in Armenian time wherever the browser or server is. */
export const TIME_ZONE = 'Asia/Yerevan'

export const SUPPORT_EMAIL = 'guests@eapps.site'
