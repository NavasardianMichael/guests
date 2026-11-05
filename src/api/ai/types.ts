import type { IncomingGuest } from '@store/lists/single/types'
import type { Endpoint } from '@interfaces/api'

/** One photo of a list, as a downsized JPEG data URL (`helpers/image.ts#fileToUploadDataUrl`). */
export type ExtractGuestsPayload = { image: string }

export type ExtractGuestsResponse = { guests: IncomingGuest[] }

export type ExtractGuestsAPI = Endpoint<{
  payload: ExtractGuestsPayload
  response: ExtractGuestsResponse
  processed: IncomingGuest[]
}>
