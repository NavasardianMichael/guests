import { FREE_TEMPLATE_IDS, type TemplateId } from '../lib/catalogue.js'

/**
 * Who may print what. The business model is cv-builder's — building is free, a premium
 * template's print is a one-time payment per list, the free templates print free with a small
 * "made with" line — but billing is not built yet (`docs/BILLING.md`). Until it is,
 * `billingEnabled` is false and every print is the full, unmarked one.
 *
 * Every PDF route asks here, so turning billing on is: build the checkout, set `paidAt`, flip
 * `BILLING_ENABLED` (or read it from config). Nothing else decides.
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
  if (!billingEnabled()) return { allowed: true, watermark: false }
  if (list.paidAt) return { allowed: true, watermark: false }
  const free = FREE_TEMPLATE_IDS.includes(list.templateId)
  return { allowed: free, watermark: free }
}
