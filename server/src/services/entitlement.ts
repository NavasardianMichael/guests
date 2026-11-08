import { FREE_TEMPLATE_IDS, type TemplateId } from '../lib/catalogue.js'

/**
 * Who may print what. The business model is cv-builder's — building is free, a premium
 * template's print is a one-time payment per list, the free template prints free — but the
 * checkout is not built yet (`docs/BILLING.md`). Premium templates are already refused unless
 * the list is paid, so today only the free one (`FREE_TEMPLATE_IDS`) prints at all.
 *
 * As in cv-builder, every download not paid for carries the "made with" line on each page; a
 * paid list prints clean. `BILLING_ENABLED` only tells the web whether checkout is live
 * (`/health`). Every PDF route asks here, so nothing else decides.
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
  return { allowed: FREE_TEMPLATE_IDS.includes(list.templateId), watermark: true }
}
