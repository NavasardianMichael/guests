import { cookies } from 'next/headers'
import { getRequestConfig } from 'next-intl/server'
import { DEFAULT_LOCALE, isLocale, type Locale, LOCALE_COOKIE, TIME_ZONE } from '@constants/app'

const MESSAGES: Record<Locale, () => Promise<{ default: Record<string, unknown> }>> = {
  hy: () => import('../messages/hy.json'),
  ru: () => import('../messages/ru.json'),
  en: () => import('../messages/en.json'),
}

/**
 * The language of a request: the one picked in the switcher (`LanguageSwitcher`, a cookie),
 * else Armenian. Deliberately not the browser's `Accept-Language`: most browsers in Armenia
 * are set to English or Russian, and the product is Armenian first. No URL segment either —
 * one set of pages, indexed in Armenian; the cookie only changes the interface.
 */
export default getRequestConfig(async ({ locale: explicit }) => {
  // An explicit locale (`getTranslations({ locale: 'hy' })` in a static route: OG images,
  // llms.txt) must not read cookies, which would make that route dynamic.
  const chosen = isLocale(explicit) ? explicit : (await cookies()).get(LOCALE_COOKIE)?.value
  const locale: Locale = isLocale(chosen) ? chosen : DEFAULT_LOCALE
  return {
    locale,
    messages: (await MESSAGES[locale]()).default,
    timeZone: TIME_ZONE,
  }
})
