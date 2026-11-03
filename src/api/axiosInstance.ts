import axios, { type AxiosError } from 'axios'
import type { APIResponse } from '@interfaces/api'
import { API_REQUEST_TIMEOUT_MS } from '@constants/app'
import { getApiUrl } from '@helpers/url'

/**
 * Every request carries the session cookie (`withCredentials`) and a timeout. A 401 is
 * **not** turned into a redirect here: in this app a guest is a normal state (they build a
 * CV without an account), so each caller decides what signed-out means for it.
 */
export const axiosInstance = axios.create({
  baseURL: getApiUrl(),
  headers: { 'Content-Type': 'application/json' },
  timeout: API_REQUEST_TIMEOUT_MS,
  withCredentials: true,
})

/** `[status] METHOD path — <server message>`: what the development details show. */
const describeFailedRequest = (error: AxiosError<Partial<APIResponse<unknown>>>): string => {
  const method = (error.config?.method ?? 'get').toUpperCase()
  const status = error.response?.status ?? error.code ?? 'no response'
  const serverMessage = error.response?.data?.error?.message
  return `[${status}] ${method} ${error.config?.url ?? ''} — ${serverMessage ?? error.message}`
}

axiosInstance.interceptors.response.use(null, (error: unknown) => {
  if (axios.isAxiosError(error)) error.message = describeFailedRequest(error)
  return Promise.reject(error)
})
