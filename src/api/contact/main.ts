import { ENDPOINTS } from './endpoints'
import type { SendContactMessageAPI } from './types'
import { axiosInstance } from '../axiosInstance'

export const sendContactMessageAPI: SendContactMessageAPI['api'] = async (payload) => {
  await axiosInstance.post(ENDPOINTS.send, payload)
}
