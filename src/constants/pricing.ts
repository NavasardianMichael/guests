/**
 * The business model, as cv-builder's: building is free; printing a list in a premium
 * template is a one-time payment per list; the free templates always print free (with a small
 * "made with" line). Billing is not built yet (`docs/BILLING.md`): until the API reports
 * `billing: true`, every template prints free and without the line.
 *
 * The server's `LIST_PRICE_AMD` (`server/src/services/pricing.ts`) is the one that will be
 * charged; `twins.spec.ts` pins them equal.
 */
export const LIST_PRICE_AMD = 2000

export const CURRENCY = 'AMD'

/** "2,000 դրամ" — grouped the way Armenian sites print prices; the unit is translated by the caller. */
export const formatAmount = (amount: number): string => amount.toLocaleString('en-US')
