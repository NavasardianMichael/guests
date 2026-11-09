export const ENDPOINTS = {
  /** The templates this visitor (account or guest key) has bought. */
  owned: '/purchases',
  /** Starts buying a template: answers the bank page's URL. */
  checkout: '/purchases/checkout',
} as const
