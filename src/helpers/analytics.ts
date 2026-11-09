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
  /** The buyer left for the bank to buy a pass of `days`; `extend`: one was still running. */
  begin_checkout: { currency: string; value: number; days: number; extend: boolean }
  /** `transaction_id` is our payment's id: GA counts a repeated one once. */
  purchase: { currency: string; value: number; transaction_id: string; days: number }
  sign_up: { method: 'password' }
  login: { method: 'password' }
}

export const trackEvent = <Name extends keyof AnalyticsEvents>(name: Name, params: AnalyticsEvents[Name]): void => {
  if (GA_ID) sendGAEvent('event', name, params)
}
