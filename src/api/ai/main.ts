import type { APIResponse } from '@interfaces/api'
import { API_AI_TIMEOUT_MS } from '@constants/app'
import { ENDPOINTS } from './endpoints'
import type { ExtractGuestsAPI, ExtractGuestsResponse } from './types'
import { axiosInstance } from '../axiosInstance'

/** Reads the names (and tables, where written) off a photo of a guest list. */
export const extractGuestsAPI: ExtractGuestsAPI['api'] = async (payload) => {
  const { data } = await axiosInstance.post<APIResponse<ExtractGuestsResponse>>(ENDPOINTS.extractGuests, payload, {
    timeout: API_AI_TIMEOUT_MS,
  })
  return data.value.guests
}
