import { FREE_TEMPLATE_IDS, type TemplateId } from '../lib/catalogue.js'

/**
 * Who may print what. The business model is cv-builder's — building is free, a premium
 * template's print is a one-time payment per list, the free template prints free — but the
 * checkout is not built yet (`docs/BILLING.md`). Premium templates are already refused unless
 * the list is paid, so today only the free one (`FREE_TEMPLATE_IDS`) prints at all.
 *
 * `BILLING_ENABLED` only switches on the "made with" line a free print carries once payments
 * are live. Every PDF route asks here, so nothing else decides.
 */
const BILLING_ENABLED = false

export const billingEnabled = (): boolean => BILLING_ENABLED

export type PrintTerms = {
  /** May print the design as made. */
  allowed: boolean
  /** Stamp the "made with" line on every page. */
  watermark: boolean
}

export const printTerms = (list: { templateId: TemplateId; paidAt: Date | null }): PrintTerms => {
  if (list.paidAt) return { allowed: true, watermark: false }
  const free = FREE_TEMPLATE_IDS.includes(list.templateId)
  return { allowed: free, watermark: free && billingEnabled() }
}
