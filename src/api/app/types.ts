import type { Endpoint } from '@interfaces/api'

/** What the API can do right now: the Google button, photo import (AI), whether a pass can be bought. */
export type AppCapabilities = { google: boolean; ai: boolean; payments: boolean; priceAmd: number }

export type HealthResponse = AppCapabilities & { status: string }

export type GetCapabilitiesAPI = Endpoint<{ payload: void; response: HealthResponse; processed: AppCapabilities }>
