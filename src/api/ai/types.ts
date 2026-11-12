import type { IncomingGuest } from '@store/lists/single/types'
import type { Endpoint } from '@interfaces/api'

/** One photo of a list, as a downsized JPEG data URL (`helpers/image.ts#fileToUploadDataUrl`). */
export type ExtractGuestsPayload = { image: string }

/**
 * Whether this visitor may read a photo (`server/src/services/photoQuota.ts`): `locked` without
 * full access, `used` once every read of the running access is spent, `available` otherwise —
 * `remaining` of `allowance` (`PHOTO_READS_PER_PASS` per pass) left until `until`, when access ends.
 */
export type PhotoState = 'locked' | 'available' | 'used'
export type PhotoStatusResponse = { state: PhotoState; allowance: number; remaining: number; until: string | null }
/** `until` in epoch ms. */
export type PhotoStatus = { state: PhotoState; allowance: number; remaining: number; until: number | null }
export type GetPhotoStatusAPI = Endpoint<{ payload: void; response: PhotoStatusResponse; processed: PhotoStatus }>

/** The guests read, and the reads left after this one (a photo with no names gives its read back). */
export type ExtractGuestsResponse = { guests: IncomingGuest[]; photo: PhotoStatusResponse }
export type ExtractedGuests = { guests: IncomingGuest[]; photo: PhotoStatus }

export type ExtractGuestsAPI = Endpoint<{
  payload: ExtractGuestsPayload
  response: ExtractGuestsResponse
  processed: ExtractedGuests
}>
