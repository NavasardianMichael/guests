import type { GuestList, ListDocument } from '@store/lists/single/types'
import type { Endpoint } from '@interfaces/api'

export type GetListsAPI = Endpoint<{ payload: void; response: GuestList[]; processed: GuestList[] }>

export type CreateListAPI = Endpoint<{ payload: ListDocument; response: GuestList; processed: GuestList }>

export type GetListAPI = Endpoint<{ payload: { id: string }; response: GuestList; processed: GuestList }>

export type UpdateListPayload = { id: string } & Partial<ListDocument>
export type UpdateListResponse = { updatedAt: string; paidAt: string | null }
export type UpdateListAPI = Endpoint<{
  payload: UpdateListPayload
  response: UpdateListResponse
  processed: UpdateListResponse
}>

export type DuplicateListAPI = Endpoint<{ payload: { id: string }; response: GuestList; processed: GuestList }>

export type DeleteListAPI = Endpoint<{ payload: { id: string }; response: null; processed: void }>

/** Not enveloped: the API answers the PDF bytes themselves. */
export type DownloadListPdfAPI = Endpoint<{ payload: { id: string }; processed: Blob }>

/** The PDF of a document only this browser holds (a guest's draft). */
export type DownloadDraftPdfAPI = Endpoint<{ payload: ListDocument; processed: Blob }>
