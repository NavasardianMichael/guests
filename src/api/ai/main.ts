import type { APIResponse } from '@interfaces/api'
import { API_AI_TIMEOUT_MS } from '@constants/app'
import { ENDPOINTS } from './endpoints'
import type { ExtractGuestsAPI, ExtractGuestsResponse, GetPhotoStatusAPI, PhotoStatus, PhotoStatusResponse } from './types'
import { axiosInstance } from '../axiosInstance'

const toEpoch = (iso: string | null): number | null => {
  const ms = iso ? Date.parse(iso) : NaN
  return Number.isFinite(ms) ? ms : null
}

const toPhotoStatus = (value: PhotoStatusResponse): PhotoStatus => ({ ...value, until: toEpoch(value.until) })

/** Reads the names (and tables, where written) off a photo of a guest list. */
export const extractGuestsAPI: ExtractGuestsAPI['api'] = async (payload) => {
  const { data } = await axiosInstance.post<APIResponse<ExtractGuestsResponse>>(ENDPOINTS.extractGuests, payload, {
    timeout: API_AI_TIMEOUT_MS,
  })
  return { guests: data.value.guests, photo: toPhotoStatus(data.value.photo) }
}

/** Whether this visitor may read a photo now, and how many reads are left. */
export const getPhotoStatusAPI: GetPhotoStatusAPI['api'] = async () => {
  const { data } = await axiosInstance.get<APIResponse<PhotoStatusResponse>>(ENDPOINTS.photoStatus)
  return toPhotoStatus(data.value)
}
