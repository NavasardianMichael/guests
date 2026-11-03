import type { Endpoint } from '@interfaces/api'

/** `website` is the honeypot: always '' from a person (`ContactForm`). */
export type ContactPayload = { fullName: string; email: string; message: string; website: string }

export type SendContactMessageAPI = Endpoint<{ payload: ContactPayload; response: null; processed: void }>
