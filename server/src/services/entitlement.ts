import { FREE_TEMPLATE_IDS, type TemplateId } from '../lib/catalogue.js'

/**
 * Who may print what (docs/PAYMENTS.md). Building is free; an access pass opens everything for
 * its days; without one, the free template (`FREE_TEMPLATE_IDS`) still prints for anyone. As in
 * cv-builder, every download not paid for carries the "made with" line on each page; a print
 * under a pass is clean. Every PDF route asks here (through `printTermsFor` in
 * services/payments.ts, which knows the owner's payments), so nothing else decides.
 * Import-free, so a unit test can hold it.
 */
export type PrintTerms = {
  /** May print the design as made. */
  allowed: boolean
  /** Stamp the "made with" line on every page. */
  watermark: boolean
}

/** Pure: the terms, given whether the owner's pass is running. */
export const printTerms = (list: { templateId: TemplateId; active: boolean }): PrintTerms => {
  if (list.active) return { allowed: true, watermark: false }
  return { allowed: FREE_TEMPLATE_IDS.includes(list.templateId), watermark: true }
}

const DAY_MS = 24 * 60 * 60 * 1000

export type PaidPass = { id: string; paidAt: Date }

/**
 * Pure: the owner's access, from their succeeded payments. Each adds `days`, starting when it
 * was paid or, if a pass was still running then, when that one ends — so a pass bought early is
 * never lost. `until` is when the last window ends (in the past once it has run out; null with
 * no payment). `chain` is the payments the latest window is made of, oldest first: the ones a
 * refund could still shorten, and the last of them is what a download counts against.
 */
export const accessWindow = (payments: readonly PaidPass[], days: number): { until: Date | null; chain: PaidPass[] } => {
  const sorted = [...payments].sort((a, b) => a.paidAt.getTime() - b.paidAt.getTime())
  let until: number | null = null
  let chain: PaidPass[] = []
  for (const payment of sorted) {
    const paid = payment.paidAt.getTime()
    if (until === null || paid >= until) {
      chain = [payment]
      until = paid + days * DAY_MS
    } else {
      chain.push(payment)
      until += days * DAY_MS
    }
  }
  return { until: until === null ? null : new Date(until), chain }
}
