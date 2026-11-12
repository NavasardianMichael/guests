import type { CheckoutAPI, GetAccessAPI } from './types'

/** An unreadable date counts as no access: the API still prints what is paid for. */
export const processAccessResponse: GetAccessAPI['processor'] = (response) => {
  const until = response.value.accessUntil ? Date.parse(response.value.accessUntil) : NaN
  return { until: Number.isFinite(until) ? until : null, payment: response.value.payment ?? null }
}

export const processCheckoutResponse: CheckoutAPI['processor'] = (response) =>
  'openPayment' in response.value
    ? { kind: 'open', minutesAgo: response.value.openPayment.minutesAgo }
    : { kind: 'redirect', url: response.value.redirectUrl }
