import type { GetCapabilitiesAPI } from './types'

export const processCapabilitiesResponse: GetCapabilitiesAPI['processor'] = (response) => ({
  google: Boolean(response.value.google),
  ai: Boolean(response.value.ai),
  payments: Boolean(response.value.payments),
  priceAmd: response.value.priceAmd,
})
