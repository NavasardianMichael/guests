import { FREE_TEMPLATE_IDS, type TemplateId } from '../lib/catalogue.js'

/**
 * Who may print what (docs/PAYMENTS.md). Building is free; a premium template is bought once
 * and then prints on every list its buyer has or makes; the free template (`FREE_TEMPLATE_IDS`)
 * prints for anyone. As in cv-builder, every download not paid for carries the "made with"
 * line on each page; a bought template prints clean. Every PDF route asks here (through
 * `printTermsFor` in services/payments.ts, which knows what the owner bought), so nothing else
 * decides. Import-free, so a unit test can hold it.
 */
export type PrintTerms = {
  /** May print the design as made. */
  allowed: boolean
  /** Stamp the "made with" line on every page. */
  watermark: boolean
}

/** Pure: the terms, given whether the owner holds the template. */
export const printTerms = (list: { templateId: TemplateId; owned: boolean }): PrintTerms => {
  if (list.owned) return { allowed: true, watermark: false }
  return { allowed: FREE_TEMPLATE_IDS.includes(list.templateId), watermark: true }
}
