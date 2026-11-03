import type { Endpoint } from '@interfaces/api'

/** What the API can do right now: the Google button, photo import (AI), whether printing is paid yet. */
export type AppCapabilities = { google: boolean; ai: boolean; billing: boolean; priceAmd: number }

export type HealthResponse = AppCapabilities & { status: string }

export type GetCapabilitiesAPI = Endpoint<{ payload: void; response: HealthResponse; processed: AppCapabilities }>
