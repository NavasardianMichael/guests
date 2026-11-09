import type { APIResponse } from '@interfaces/api'
import { ENDPOINTS } from './endpoints'
import { processCheckoutResponse, processOwnedTemplatesResponse } from './processors'
import type { CheckoutResponse, CheckoutTemplateAPI, GetOwnedTemplatesAPI, OwnedTemplatesResponse } from './types'
import { axiosInstance } from '../axiosInstance'

export const getOwnedTemplatesAPI: GetOwnedTemplatesAPI['api'] = async () => {
  const { data } = await axiosInstance.get<APIResponse<OwnedTemplatesResponse>>(ENDPOINTS.owned)
  return processOwnedTemplatesResponse(data)
}

export const checkoutTemplateAPI: CheckoutTemplateAPI['api'] = async (payload) => {
  const { data } = await axiosInstance.post<APIResponse<CheckoutResponse>>(ENDPOINTS.checkout, payload)
  return processCheckoutResponse(data)
}
