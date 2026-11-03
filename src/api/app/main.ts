import type { APIResponse } from '@interfaces/api'
import { ENDPOINTS } from './endpoints'
import { processCapabilitiesResponse } from './processors'
import type { GetCapabilitiesAPI, HealthResponse } from './types'
import { axiosInstance } from '../axiosInstance'

export const getCapabilitiesAPI: GetCapabilitiesAPI['api'] = async () => {
  const { data } = await axiosInstance.get<APIResponse<HealthResponse>>(ENDPOINTS.health)
  return processCapabilitiesResponse(data)
}
