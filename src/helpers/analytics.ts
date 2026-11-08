import { sendGAEvent } from '@next/third-parties/google'

/**
 * Google Analytics 4. `NEXT_PUBLIC_GA_ID` is inlined at build time; empty — local dev, CI —
 * means no tag and no events. Page views are GA's own (history changes included); these are
 * the few moments worth counting on top of them. No guest names and no account ids go here.
 */
export const GA_ID = process.env.NEXT_PUBLIC_GA_ID ?? ''

type AnalyticsEvents = {
  /** A PDF saved or sent to the printer: which kind of sheet, in which template. */
  list_pdf: { kind: string; template: string }
  /** A list imported: from where, and how many guests came in. */
  guests_import: { source: 'paste' | 'file' | 'photo'; count: number; mode: 'append' | 'replace' }
  sign_up: { method: 'password' }
  login: { method: 'password' }
}

export const trackEvent = <Name extends keyof AnalyticsEvents>(name: Name, params: AnalyticsEvents[Name]): void => {
  if (GA_ID) sendGAEvent('event', name, params)
}
