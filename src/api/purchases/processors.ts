import { isTemplateId } from '@constants/templates'
import type { CheckoutTemplateAPI, GetOwnedTemplatesAPI } from './types'

/** Ids this build does not know (a template since removed) are dropped. */
export const processOwnedTemplatesResponse: GetOwnedTemplatesAPI['processor'] = (response) =>
  response.value.templates.filter(isTemplateId)

export const processCheckoutResponse: CheckoutTemplateAPI['processor'] = (response) => response.value.checkoutUrl
