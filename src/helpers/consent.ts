import { sendGAEvent } from '@next/third-parties/google'
import { CONSENT_TIME_ZONES } from '@constants/consent'
import { GA_ID } from './analytics'

/**
 * Google Consent Mode v2 (as the crossword app). Where the law asks for an opt-in
 * (`CONSENT_TIME_ZONES`: the EU and EEA, the UK, Switzerland), GA starts with analytics storage
 * denied — no cookies, only cookieless pings — and the banner (`ConsentBanner`) asks; accepting
 * or closing it grants. Everywhere else, Armenia included, analytics storage is granted from the
 * first page and no banner shows. Ads storage is always denied: the site shows no ads. An answer
 * is kept in this browser and can be changed from "Cookie settings" in the footer, wherever the
 * visitor is. Storage can throw (blocked site data); then the banner asks again next visit.
 */
export type ConsentChoice = 'granted' | 'denied'

/** Whether a device in this time zone is asked first. An unknown or UTC zone (privacy browsers) is. */
export const asksForConsent = (timeZone: string | undefined): boolean =>
  !timeZone || timeZone === 'UTC' || timeZone.startsWith('Etc/') || CONSENT_TIME_ZONES.includes(timeZone)

const deviceTimeZone = (): string | undefined => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone
  } catch {
    return undefined
  }
}

const KEY = 'guests:analytics-consent:v1'

export const readConsent = (): ConsentChoice | null => {
  try {
    const value = window.localStorage.getItem(KEY)
    return value === 'granted' || value === 'denied' ? value : null
  } catch {
    return null
  }
}

/** Whether the banner shows — a `useSyncExternalStore` source, read only in the browser. */
let bannerOpen: boolean | null = null
const listeners = new Set<() => void>()
const emit = (): void => listeners.forEach((listener) => listener())

export const subscribeConsentBanner = (listener: () => void): (() => void) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Open until the visitor answers, where an opt-in is needed; never without a GA tag to ask about. */
export const isConsentBannerOpen = (): boolean =>
  (bannerOpen ??= Boolean(GA_ID) && readConsent() === null && asksForConsent(deviceTimeZone()))

/** "Cookie settings" in the footer: ask again. */
export const openConsentBanner = (): void => {
  bannerOpen = Boolean(GA_ID)
  emit()
}

export const saveConsent = (choice: ConsentChoice): void => {
  try {
    window.localStorage.setItem(KEY, choice)
  } catch {
    // Site data blocked: the answer holds for this page, and the banner asks again next visit.
  }
  if (GA_ID) sendGAEvent('consent', 'update', { analytics_storage: choice })
  bannerOpen = false
  emit()
}

/**
 * Runs before the GA tag (inline, in the root layout): ads denied; analytics granted by a stored
 * "yes", denied by a stored "no", and otherwise by region — denied where `asksForConsent`
 * (mirrored here, tested against it), granted elsewhere. So a visitor is counted from the first
 * page view.
 */
export const consentDefaultsScript = (): string => `
window.dataLayer = window.dataLayer || [];
function gtag(){ dataLayer.push(arguments); }
var stored = null;
try { stored = localStorage.getItem(${JSON.stringify(KEY)}); } catch (e) {}
var zone = '';
try { zone = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) {}
var asks = !zone || zone === 'UTC' || zone.indexOf('Etc/') === 0 || ${JSON.stringify(CONSENT_TIME_ZONES)}.indexOf(zone) !== -1;
gtag('consent', 'default', {
  ad_storage: 'denied',
  ad_user_data: 'denied',
  ad_personalization: 'denied',
  analytics_storage: stored === 'granted' || (stored !== 'denied' && !asks) ? 'granted' : 'denied',
});
`
