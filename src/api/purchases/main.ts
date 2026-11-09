import type { APIResponse } from '@interfaces/api'
import { ENDPOINTS } from './endpoints'
import { processAccessResponse, processCheckoutResponse } from './processors'
import type { AccessResponse, CheckoutAPI, CheckoutResponse, GetAccessAPI } from './types'
import { axiosInstance } from '../axiosInstance'

export const getAccessAPI: GetAccessAPI['api'] = async (payload) => {
  const params = payload?.paymentId ? { payment: payload.paymentId } : undefined
  const { data } = await axiosInstance.get<APIResponse<AccessResponse>>(ENDPOINTS.access, { params })
  return processAccessResponse(data)
}

export const checkoutAPI: CheckoutAPI['api'] = async (payload) => {
  const { data } = await axiosInstance.post<APIResponse<CheckoutResponse>>(ENDPOINTS.checkout, payload)
  return processCheckoutResponse(data)
}
