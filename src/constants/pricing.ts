/**
 * The business model (docs/PAYMENTS.md): building is free; a premium **template** is bought
 * once and then prints on every list its buyer has or makes, without the "made with" line; the
 * free template always prints free (with the line).
 *
 * The server's `TEMPLATE_PRICE_AMD` (`server/src/services/pricing.ts`) is the one charged;
 * `twins.spec.ts` pins them equal.
 */
export const TEMPLATE_PRICE_AMD = 2000

export const CURRENCY = 'AMD'

/** "2,000 դրամ" — grouped the way Armenian sites print prices; the unit is translated by the caller. */
export const formatAmount = (amount: number): string => amount.toLocaleString('en-US')
