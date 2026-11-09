export const ENDPOINTS = {
  /** When this visitor's (account or guest key) access pass ends; `?payment=` adds that payment's status. */
  access: '/purchases',
  /** Starts buying a pass: answers the bank page's URL. */
  checkout: '/purchases/checkout',
} as const
