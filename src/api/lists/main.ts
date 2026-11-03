import type { GuestList } from '@store/lists/single/types'
import type { APIResponse } from '@interfaces/api'
import { API_PDF_TIMEOUT_MS } from '@constants/app'
import { ENDPOINTS } from './endpoints'
import { processListResponse, processListsResponse, processUpdateListResponse } from './processors'
import type {
  CreateListAPI,
  DeleteListAPI,
  DownloadDraftPdfAPI,
  DownloadListPdfAPI,
  DuplicateListAPI,
  GetListAPI,
  GetListsAPI,
  UpdateListAPI,
  UpdateListResponse,
} from './types'
import { axiosInstance } from '../axiosInstance'

export const getListsAPI: GetListsAPI['api'] = async () => {
  const { data } = await axiosInstance.get<APIResponse<GuestList[]>>(ENDPOINTS.list)
  return processListsResponse(data)
}

export const createListAPI: CreateListAPI['api'] = async (payload) => {
  const { data } = await axiosInstance.post<APIResponse<GuestList>>(ENDPOINTS.create, payload)
  return processListResponse(data)
}

export const getListAPI: GetListAPI['api'] = async ({ id }) => {
  const { data } = await axiosInstance.get<APIResponse<GuestList>>(`${ENDPOINTS.single}/${encodeURIComponent(id)}`)
  return processListResponse(data)
}

export const updateListAPI: UpdateListAPI['api'] = async ({ id, ...payload }) => {
  const { data } = await axiosInstance.put<APIResponse<UpdateListResponse>>(
    `${ENDPOINTS.update}/${encodeURIComponent(id)}`,
    payload
  )
  return processUpdateListResponse(data)
}

export const duplicateListAPI: DuplicateListAPI['api'] = async ({ id }) => {
  const { data } = await axiosInstance.post<APIResponse<GuestList>>(
    `${ENDPOINTS.duplicate}/${encodeURIComponent(id)}/duplicate`
  )
  return processListResponse(data)
}

export const deleteListAPI: DeleteListAPI['api'] = async ({ id }) => {
  await axiosInstance.delete(`${ENDPOINTS.remove}/${encodeURIComponent(id)}`)
}

/**
 * A PDF request's failure still answers the JSON envelope, which axios hands over as a Blob
 * too; it is parsed back so `classifyError` can read its code.
 */
const rethrowPdfError = async (error: unknown): Promise<never> => {
  const response = (error as { response?: { data?: unknown } }).response
  if (response?.data instanceof Blob) {
    try {
      response.data = JSON.parse(await response.data.text())
    } catch {
      // Not JSON; leave it for the generic copy.
    }
  }
  throw error
}

export const downloadListPdfAPI: DownloadListPdfAPI['api'] = async ({ id }) => {
  try {
    const { data } = await axiosInstance.get<Blob>(`${ENDPOINTS.pdf}/${encodeURIComponent(id)}/pdf`, {
      responseType: 'blob',
      timeout: API_PDF_TIMEOUT_MS,
    })
    return data
  } catch (error) {
    return rethrowPdfError(error)
  }
}

/** A guest's draft, sent as the body: the server prints it and keeps nothing. */
export const downloadDraftPdfAPI: DownloadDraftPdfAPI['api'] = async (payload) => {
  try {
    const { data } = await axiosInstance.post<Blob>(ENDPOINTS.draftPdf, payload, {
      responseType: 'blob',
      timeout: API_PDF_TIMEOUT_MS,
    })
    return data
  } catch (error) {
    return rethrowPdfError(error)
  }
}
